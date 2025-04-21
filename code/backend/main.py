"""
Main backend application module.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, Body, Depends, Request, WebSocketDisconnect, status, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.websockets import WebSocketState
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import json
from json.decoder import JSONDecodeError
import asyncio
import random
import psutil
from dotenv import load_dotenv
import os
import time
import uvicorn
import logging
import re
import sys
from enum import Enum
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage
from langchain.memory import ConversationBufferMemory
from database import SessionLocal, init_db, Agent as DBAgent, Message as DBMessage, Tool as DBTool, Conversation as DBConversation
from database import AgentStatusEnum, MessageTypeEnum
import uuid
from utils.config_loader import config_loader

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load configuration
config = config_loader.get_config()

# Load the backend access key from environment variables
BACKEND_ACCESS_KEY = os.getenv("BACKEND_ACCESS_KEY")
logger.info(f"Loaded BACKEND_ACCESS_KEY: {'********' if BACKEND_ACCESS_KEY else 'Not Set'}")
if not BACKEND_ACCESS_KEY:
    logger.warning("BACKEND_ACCESS_KEY environment variable not set. API endpoints requiring a key may be unprotected.")

# Define the API Key Header scheme
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key_header: str = Depends(API_KEY_HEADER)):
    """Dependency function to verify the provided API key."""
    # If BACKEND_ACCESS_KEY is not set in the environment, skip verification (less secure)
    if not BACKEND_ACCESS_KEY:
        # logger.warning("Skipping API key verification as BACKEND_ACCESS_KEY is not set.")
        return
        
    if not api_key_header:
        logger.warning("Missing X-API-Key header.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API Key",
        )
    if api_key_header != BACKEND_ACCESS_KEY:
        logger.warning("Invalid API Key received.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
    # Key is valid
    logger.debug("Valid API Key received.")

class MCPMetrics:
    def __init__(self):
        system_config = config['system']
        self.total_tokens = 0
        self.active_roles = set()
        self.total_messages = 0
        self.memory_objects = 0
        self.context_history = []
        self.max_tokens = system_config['safety']['max_tokens_per_request']
        self.last_update = datetime.now()
        self.update_interval = system_config['metrics']['update_interval']
        self.max_history_points = system_config['metrics']['history_points']

    def update_metrics(self, agents_data, messages_data):
        """Update all metrics based on current system state"""
        self.active_roles = {agent.role for agent in agents_data.values() if agent.status == 'active'}
        self.total_messages = len(messages_data)
        self.total_tokens = sum(msg.token_count for msg in messages_data.values())
        self.memory_objects = len(agents_data)
        
        current_time = datetime.now()
        if (current_time - self.last_update).seconds >= self.update_interval:
            self.context_history.append({
                'timestamp': current_time.isoformat(),
                'tokens_used': self.total_tokens
            })
            if len(self.context_history) > self.max_history_points:
                self.context_history.pop(0)
            self.last_update = current_time

    def get_metrics(self):
        """Get current metrics"""
        return {
            'roles': len(self.active_roles),
            'messages': self.total_messages,
            'memory_objects': self.memory_objects,
            'context': {
                'total_tokens': self.total_tokens,
                'max_tokens': self.max_tokens,
                'usage_percentage': (self.total_tokens / self.max_tokens) * 100 if self.max_tokens > 0 else 0,
                'history': self.context_history
            }
        }

# Import tools
try:
    from tools.web_search import process_web_search
    from tools.code_analysis import process_code_analysis
    from tools.text_processing import process_text
    from utils.config_loader import config_loader
    logger.info("Successfully imported all required modules")
except Exception as e:
    logger.error(f"Error importing modules: {str(e)}")
    raise

# Load configuration
try:
    config = config_loader.get_config()
    logger.info("Successfully loaded configuration")
except Exception as e:
    logger.error(f"Error loading configuration: {str(e)}")
    raise

class ConnectionManager:
    """Manages WebSocket connections for real-time communication."""
    
    def __init__(self):
        """Initialize the connection manager."""
        self.active_connections: Dict[str, List[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, agent_id: str):
        """Connect a new WebSocket for a specific agent."""
        await websocket.accept()
        if agent_id not in self.active_connections:
            self.active_connections[agent_id] = []
        self.active_connections[agent_id].append(websocket)
        logger.info(f"New WebSocket connection established for agent {agent_id}")
        
    def disconnect(self, websocket: WebSocket, agent_id: str):
        """Disconnect a WebSocket for a specific agent."""
        if agent_id in self.active_connections:
            self.active_connections[agent_id].remove(websocket)
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]
        logger.info(f"WebSocket connection closed for agent {agent_id}")
        
    async def broadcast(self, message: dict, agent_id: str):
        """Broadcast a message to all connected WebSockets for a specific agent."""
        if agent_id not in self.active_connections:
            return
            
        dead_connections = []
        for connection in self.active_connections[agent_id]:
            try:
                await connection.send_json(message)
            except RuntimeError as e:
                dead_connections.append(connection)
                logger.error(f"Error broadcasting message: {str(e)}")
                
        # Clean up dead connections
        for dead_connection in dead_connections:
            self.active_connections[agent_id].remove(dead_connection)
            
        if not self.active_connections[agent_id]:
            del self.active_connections[agent_id]
            
    async def handle_failed_connection(self, websocket: WebSocket, agent_id: str):
        """Handle a failed WebSocket connection attempt."""
        try:
            await websocket.close(code=status.WS_1006_ABNORMAL_CLOSURE)
        except RuntimeError as e:
            logger.error(f"Error closing failed connection: {str(e)}")
        if agent_id in self.active_connections and websocket in self.active_connections[agent_id]:
            self.active_connections[agent_id].remove(websocket)
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI application"""
    # Startup
    logger.info("Initializing application...")
    await startup_event()
    logger.info("Application initialized")
    yield
    # Shutdown
    logger.info("Shutting down application...")

app = FastAPI(
    title="Agent System",
    version=config['api']['version'],
    lifespan=lifespan
)

# Initialize connection manager for WebSocket connections
manager = ConnectionManager()

# Configure CORS from config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Specify allowed origins explicitly
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    # expose_headers=["*"] # expose_headers might not be needed unless specific headers must be read by JS
)

# Load environment variables
load_dotenv()

# Access and validate OpenAI API key
openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set. Please set it in your .env file.")

if openai_key == "your_openai_api_key_here":
    raise ValueError("Please replace the placeholder API key with your actual OpenAI API key in the .env file.")

# Initialize LangChain components
llm = ChatOpenAI(
    temperature=0.7,
    model="gpt-4-turbo-preview",
    api_key=openai_key
)

# In-memory storage
agents = {}
messages = {}
tools = {}
metrics = []
active_connections = {}
conversation_history = {}
agent_handoffs = {}
mcp_metrics = MCPMetrics()  # Initialize MCP metrics

# System configuration
context_history = []
MAX_CONTEXT_SIZE = config['system']['max_context_size']
MAX_MESSAGE_LENGTH = config['system']['max_message_length']
MAX_CONVERSATION_HISTORY = config['system']['max_conversation_history']

# Initialize default agent
default_agent = DBAgent(
    id="default_agent",
    name="AI Assistant",
    role="assistant",
    goal="Help users with general tasks, questions, and provide informative responses",
    capabilities=[
        "general_assistance",
        "task_management",
        "code_help",
        "research"
    ],
    status=AgentStatusEnum.ACTIVE
)
agents["default_agent"] = default_agent
conversation_history["default_agent"] = []
logger.info("Initialized default agent")

# Agent route request model
class RouteRequest(BaseModel):
    message: str

# Agent handoff request model
class HandoffRequest(BaseModel):
    fromAgentId: str
    toAgentId: str
    message: str
    conversationContext: Optional[Dict[str, Any]] = None

# Message model
class Message(BaseModel):
    type: str
    content: str
    agent_id: Optional[str] = None
    timestamp: Optional[str] = None
    status: Optional[str] = None
    sender: Optional[str] = None
    agent_name: Optional[str] = None
    tool_id: Optional[str] = None
    tool_name: Optional[str] = None
    tool_result: Optional[str] = None
    token_count: Optional[int] = None

# Tool request model
class ToolRequest(BaseModel):
    tool_id: Optional[str] = None
    tool_name: Optional[str] = None
    content: str
    agent_id: str
    confirmed: Optional[bool] = False

# Model classes
class AgentStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    IDLE = "idle"

class AgentCapability(str, Enum):
    GENERAL_ASSISTANCE = "general_assistance"
    CODE_HELP = "code_help"
    RESEARCH = "research"
    WRITING = "writing"
    TASK_MANAGEMENT = "task_management"

class AgentRole(str, Enum):
    ASSISTANT = "assistant"
    CODER = "coder"
    RESEARCHER = "researcher"
    WRITER = "writer"

class Agent(BaseModel):
    id: str
    name: str
    role: str
    goal: str
    capabilities: List[str]
    status: str = Field(default="active", description="Agent status: active, paused, or idle")
    created_at: Optional[datetime] = None

    class Config:
        use_enum_values = True

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['active', 'paused', 'idle']
        if v.lower() not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v.lower()

class MessageBase(BaseModel):
    content: str
    sender: str = "user"

class MessageCreate(MessageBase):
    pass

class MessageInDB(MessageBase):
    id: str
    agent_id: str
    timestamp: datetime
    token_count: int = 0
    message_type: str = "text"
    status: str = "pending"

    class Config:
        arbitrary_types_allowed = True

class Tool(BaseModel):
    id: str
    name: str
    description: str
    api_endpoint: str
    available: bool
    created_at: Optional[datetime] = None

class ReasoningStep(BaseModel):
    description: str = Field(..., description="Description of the reasoning step")
    type: str = Field(default="thinking", description="Type of step: thinking, tool_call, tool_result, error, or final_answer")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReasoningStep':
        """Create a ReasoningStep from a dictionary, handling both old and new formats."""
        if isinstance(data, dict):
            if 'description' in data:
                return cls(description=data['description'], type=data.get('type', 'thinking'))
            elif 'content' in data:
                return cls(description=data['content'], type=data.get('type', 'thinking'))
            elif 'step_number' in data:
                content = data.get('content', 'Processing step')
                return cls(description=content, type='thinking')
        raise ValueError("Invalid reasoning step data format")

class ToolUsage(BaseModel):
    tool_name: str
    tool_input: Dict[str, Any]
    result: Optional[Any] = None
    status: Optional[str] = None

class FileData(BaseModel):
    filename: str
    content: str # Assuming Base64 encoded content
    mime_type: Optional[str] = None

class ChatMessageRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    agent_id: Optional[str] = None
    files: Optional[List[FileData]] = None # Added files list

class ChatResponse(BaseModel):
    reply: str
    reasoning: List[ReasoningStep]
    tool_usage: List[ToolUsage] = []
    conversation_id: str
    agent_id: Optional[str] = None
    files_received: Optional[List[str]] = None

# Initialize sample data
async def initialize_sample_data():
    """Initialize sample agents and tools from configuration"""
    try:
        db = SessionLocal()
        
        # Initialize default agent
        default_agent = DBAgent(
            id="default_agent",
            name="AI Assistant",
            role="assistant",
            goal="Help users with general tasks, questions, and provide informative responses",
            capabilities=[
                "general_assistance",
                "task_management",
                "code_help",
                "research"
            ],
            status=AgentStatusEnum.ACTIVE
        )
        
        # Check if default agent exists
        existing_agent = db.query(DBAgent).filter(DBAgent.id == "default_agent").first()
        if not existing_agent:
            db.add(default_agent)
            logger.info("Initialized default agent")
        
        # Initialize specialized agents based on configured roles
        agent_roles = config['agents']['roles']
        for role_id, role_config in agent_roles.items():
            try:
                agent_id = f"{role_id}_agent"
                if agent_id != "default_agent":
                    # Check if agent exists
                    existing_agent = db.query(DBAgent).filter(DBAgent.id == agent_id).first()
                    if not existing_agent:
                        agent = DBAgent(
                            id=agent_id,
                            name=role_id.capitalize(),
                            role=role_id,
                            goal=role_config['goal'],
                            capabilities=role_config['capabilities'],
                            status=AgentStatusEnum.ACTIVE
                        )
                        db.add(agent)
                        logger.info(f"Initialized specialized agent: {agent_id}")
            except Exception as e:
                logger.error(f"Error initializing agent {role_id}: {str(e)}")
                continue
        
        db.commit()
        logger.info(f"Initialized agents with enhanced configurations")
    except Exception as e:
        logger.error(f"Error in initialize_sample_data: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

# API Endpoints
@app.get("/api/agents")
@app.head("/api/agents")
async def get_agents(api_key: None = Depends(verify_api_key)):
    return list(agents.values())

@app.get("/api/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, api_key: None = Depends(verify_api_key)):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agents[agent_id]

@app.get("/api/tools", response_model=List[Tool])
@app.head("/api/tools")
async def get_tools(api_key: None = Depends(verify_api_key)):
    return list(tools.values())

@app.get("/api/agents/{agent_id}/messages", response_model=List[MessageInDB])
async def get_agent_messages(agent_id: str, api_key: None = Depends(verify_api_key)):
    agent_messages = [msg for msg in messages.values() if msg.agent_id == agent_id]
    return sorted(agent_messages, key=lambda x: x.timestamp)

async def broadcast_response(agent_id: str, message: str, response: Dict[str, Any]) -> None:
    """Broadcast agent response to all connected WebSocket clients for this agent."""
    try:
        # Prepare the broadcast message
        broadcast_msg = {
            "type": "agent_message",
            "content": response["reply"],
            "timestamp": datetime.now().isoformat(),
            "status": "success",
            "sender": "agent",
            "agent_name": agents[agent_id].name if agent_id in agents else "Unknown Agent",
            "reasoning_steps": [step.dict() for step in response.get("reasoning", [])],
            "tool_usage": [tool.dict() for tool in response.get("tool_usage", [])]
        }
        
        # Broadcast the message using the global manager
        await manager.broadcast(broadcast_msg, agent_id)
        
    except Exception as e:
        logger.error(f"Error broadcasting response: {str(e)}")
        # Don't raise the exception - we don't want to break the main flow if broadcasting fails

async def process_message(agent_id: str, data: dict):
    """Process incoming WebSocket message with token tracking"""
    try:
        logger.info(f"Processing message for agent {agent_id}: {data}")
        if 'type' not in data:
            raise ValueError("Message must include a 'type' field")

        if data['type'] == 'message':
            if 'content' not in data:
                raise ValueError("Message type 'message' must include 'content'")

            # Calculate token count (simple word-based estimation)
            content = data['content']
            token_count = len(content.split())
            
            logger.info(f"Processing user message: {content}")

            # Create user message
            msg_id = str(len(messages) + 1)
            user_msg = MessageInDB(
                id=msg_id,
                agent_id=agent_id,
                content=content,
                sender=data.get('sender', 'user'),
                timestamp=datetime.now(),
                token_count=token_count,
                message_type='text',
                status='success'
            )
            messages[msg_id] = user_msg
            logger.info(f"Created user message with ID: {msg_id}")

            # Get agent details
            agent = agents.get(agent_id)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")

            # Generate response
            logger.info(f"Generating response for agent {agent.name}")
            response_content = generate_agent_response(agent, content)
            response_token_count = len(response_content.split())
            logger.info(f"Generated response: {response_content}")
            
            # Create agent message
            response_id = str(len(messages) + 1)
            agent_msg = MessageInDB(
                id=response_id,
                agent_id=agent_id,
                content=response_content,
                sender='agent',
                timestamp=datetime.now(),
                token_count=response_token_count,
                message_type='text',
                status='success'
            )
            messages[response_id] = agent_msg
            logger.info(f"Created agent message with ID: {response_id}")

            # Create context nodes
            context_nodes = [
                {
                    'type': 'User Input',
                    'content': content,
                    'timestamp': datetime.now().isoformat()
                },
                {
                    'type': 'Agent Processing',
                    'content': f"Processing request using {agent.role}",
                    'timestamp': datetime.now().isoformat()
                },
                {
                    'type': 'Agent Response',
                    'content': response_content,
                    'timestamp': datetime.now().isoformat()
                }
            ]

            # Create reasoning steps with proper format
            reasoning_steps = [
                ReasoningStep(
                    description="Received and processed user input",
                    type="thinking"
                ),
                ReasoningStep(
                    description=f"Generated response based on {agent.role} capabilities",
                    type="thinking"
                )
            ]

            # Update MCP metrics
            mcp_metrics.update_metrics(agents, messages)

            # Broadcast the response with context information
            response = {
                'type': 'agent_message',
                'content': response_content,
                'timestamp': datetime.now().isoformat(),
                'status': 'success',
                'sender': 'agent',
                'agent_name': agent.name,
                'token_count': response_token_count,
                'context': {
                    'nodes': context_nodes,
                    'reasoning_steps': [step.dict() for step in reasoning_steps],
                    'total_tokens': mcp_metrics.total_tokens,
                    'max_tokens': mcp_metrics.max_tokens
                }
            }
            logger.info(f"Broadcasting response: {response}")
            await broadcast_response(agent_id, content, response)
            return response

        elif data['type'] == 'typing':
            return {
                'type': 'status',
                'content': 'typing',
                'timestamp': datetime.now().isoformat(),
                'agent_id': agent_id
            }

        return {
            'type': 'error',
            'content': 'Unsupported message type',
            'timestamp': datetime.now().isoformat(),
            'error_code': 'UNSUPPORTED_TYPE'
        }

    except ValueError as e:
        error_response = {
            'type': 'error',
            'content': str(e),
            'timestamp': datetime.now().isoformat(),
            'error_code': 'VALIDATION_ERROR'
        }
        await broadcast_response(agent_id, content, error_response)
        return error_response

    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        error_response = {
            'type': 'error',
            'content': "An error occurred while processing your message",
            'timestamp': datetime.now().isoformat(),
            'error_code': 'PROCESSING_ERROR'
        }
        await broadcast_response(agent_id, content, error_response)
        return error_response

def generate_agent_response(agent: Agent, user_message: str) -> str:
    """Generate a response based on agent role and user message."""
    try:
        # Basic response generation based on agent role and message
        if user_message.lower().strip() in ["hi", "hey", "hello", "hola", "hi there", "hey there", "greetings"]:
            capabilities = ", ".join(agent.capabilities)
            return f"Hello! I'm your {agent.role} assistant. I can help you with: {capabilities}. How can I assist you today?"
            
        # Handle general queries
        if agent.role == "researcher":
            return f"I understand you'd like to explore '{user_message}'. As a research assistant, I can help you gather and analyze information about this topic. What specific aspects would you like to investigate?"
        elif agent.role == "coder":
            return f"I see you're interested in '{user_message}'. As a coding assistant, I can help you with code implementation, debugging, or understanding programming concepts. What would you like to focus on?"
        elif agent.role == "writer":
            return f"Regarding '{user_message}', as a writing assistant, I can help you with content creation, editing, or improving your text. What specific writing assistance do you need?"
        else:
            # Default response for general assistant
            return f"I understand your interest in '{user_message}'. I'm here to help you with any questions or tasks you have. Would you like me to explain something specific or help you accomplish a particular goal?"
            
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return "I apologize, but I'm having trouble processing your request at the moment. Could you please try again?"

@app.websocket("/ws/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    await manager.connect(websocket, agent_id)
    
    if agent_id not in agents:
        await websocket.send_json({
            "type": "error", 
            "content": "Agent not found",
            "timestamp": datetime.now().isoformat()
        })
        await websocket.close()
        return
    
    try:
        # Initialize conversation history if not exists
        if agent_id not in conversation_history:
            conversation_history[agent_id] = []
        
        # Process messages
        async for data in websocket.iter_json():
            try:
                if data.get("type") == "message":
                    content = data.get("content", "").strip()
                    
                    # Save user message to history
                    conversation_history[agent_id].append({
                        "sender": "user",
                        "content": content,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Process the message through the agent
                    result = await process_agent_request(
                        agent_id=agent_id,
                        message=content,
                        conversation_id=str(time.time()),
                        history=conversation_history[agent_id]
                    )
                    
                    # Ensure we have a proper response
                    if not result["reply"] or "placeholder" in result["reply"].lower():
                        # Generate a proper greeting if it's a greeting message
                        greeting_patterns = ["hi", "hey", "hello", "hola", "hi there", "hey there", "greetings"]
                        if content.lower().strip() in greeting_patterns:
                            agent = agents[agent_id]
                            capabilities = ", ".join(agent.capabilities)
                            result["reply"] = f"Hello! I'm your {agent.role} assistant. I can help you with: {capabilities}. How can I assist you today?"
                            result["reasoning"] = [
                                ReasoningStep(
                                    description="Received a greeting, responding with a friendly introduction and my capabilities.",
                                    type="thinking"
                                )
                            ]
                    
                    # Send the response
                    await websocket.send_json({
                        "type": "agent_message",
                        "content": result["reply"],
                        "timestamp": datetime.now().isoformat(),
                        "status": "success",
                        "sender": "agent",
                        "agent_name": agents[agent_id].name,
                        "reasoning_steps": [step.dict() for step in result.get("reasoning", [])],
                        "tool_usage": [tool.dict() for tool in result.get("tool_usage", [])]
                    })
                    
                    # Save agent response to history
                    conversation_history[agent_id].append({
                        "sender": "agent",
                        "content": result["reply"],
                        "timestamp": datetime.now().isoformat()
                    })
                    
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")
                await websocket.send_json({
                    "type": "error",
                    "content": f"Error processing message: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, agent_id)
        logger.info(f"WebSocket disconnected for agent {agent_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error for agent {agent_id}: {str(e)}")
        manager.disconnect(websocket, agent_id)

@app.options("/api/agents/{agent_id}/messages")
async def messages_options():
    return {}  # Return empty dict for OPTIONS request

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatMessageRequest, api_key: None = Depends(verify_api_key)):
    try:
        db = SessionLocal()
        logger.debug(f"Chat endpoint entered for request: {request}")
        
        # Use default agent if none specified
        selected_agent_id = request.agent_id or "default_agent"
        logger.debug(f"Selected agent ID: {selected_agent_id}")
        
        # Validate agent exists
        agent = db.query(DBAgent).filter(DBAgent.id == selected_agent_id).first()
        if not agent:
            logger.error(f"Agent {selected_agent_id} not found")
            error_steps = [
                ReasoningStep(
                    description=f"Error: Agent {selected_agent_id} not found",
                    type="error"
                )
            ]
            return ChatResponse(
                reply="Agent not found. Using default agent instead.",
                reasoning=error_steps,
                tool_usage=[],
                conversation_id=f"conv_{datetime.now().timestamp()}",
                agent_id="default_agent"
            )
        
        # Handle conversation
        conversation_id = request.conversation_id or f"conv_{datetime.now().timestamp()}"
        logger.debug(f"Conversation ID: {conversation_id}")
        
        # Get or create conversation
        conversation = db.query(DBConversation).filter(
            DBConversation.id == conversation_id
        ).first()
        
        if not conversation:
            logger.debug("Creating new conversation entry")
            conversation = DBConversation(
                id=conversation_id,
                agent_id=selected_agent_id,
                context_data={} # Use context_data instead of conversation_metadata
            )
            db.add(conversation)
        else:
            logger.debug("Found existing conversation entry")
        
        # Create user message
        logger.debug("Creating user message entry")
        user_message = DBMessage(
            id=str(uuid.uuid4()),
            agent_id=selected_agent_id,
            content=request.message,
            sender="user",
            conversation_id=conversation_id,
            message_type=MessageTypeEnum.TEXT
        )
        db.add(user_message)
        logger.debug("User message entry added to session")
        
        # Generate response using the existing process_agent_request function
        logger.debug("Calling process_agent_request")
        response_dict = await process_agent_request(
            selected_agent_id,
            request.message,
            conversation_id,
            [],  # We'll implement history retrieval later
            request.files
        )
        logger.debug(f"Received response from process_agent_request: {response_dict}")
        
        # Create agent message
        logger.debug("Creating agent message entry")
        agent_message = DBMessage(
            id=str(uuid.uuid4()),
            agent_id=selected_agent_id,
            content=response_dict["reply"], # Use response_dict
            sender="agent",
            conversation_id=conversation_id,
            message_type=MessageTypeEnum.TEXT
        )
        db.add(agent_message)
        logger.debug("Agent message entry added to session")
        
        # Commit changes
        logger.debug("Attempting database commit")
        db.commit()
        logger.debug("Database commit successful")
        
        # Prepare and return response
        logger.debug("Preparing ChatResponse object")
        chat_response = ChatResponse(**response_dict) # Use response_dict
        logger.debug("ChatResponse object created, returning response")
        return chat_response
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True) # Add exc_info=True for full traceback
        db.rollback()
        # Reraise the exception to ensure FastAPI returns a 500 error properly
        # raise HTTPException(status_code=500, detail="Internal server error") # Alternative: specific HTTP error
        raise
    finally:
        logger.debug("Closing database session")
        db.close()

@app.options("/api/chat")
async def chat_options():
    return Response(status_code=200)

@app.get("/api/metrics")
async def get_metrics(api_key: None = Depends(verify_api_key)):
    """Get system metrics including MCP data for the dashboard"""
    # Update MCP metrics with current system state
    mcp_metrics.update_metrics(agents, messages)
    
    # Get the updated metrics
    metrics_data = mcp_metrics.get_metrics()
    
    return {
        "active_agents": len([a for a in agents.values() if a.status == 'active']),
        "total_messages": len(messages),
        "recent_messages": sum(1 for msg in messages.values() 
                             if (datetime.now() - msg.timestamp).total_seconds() < 3600),
        "system_load": psutil.cpu_percent(),
        "memory_usage": psutil.virtual_memory().percent,
        "mcp": metrics_data
    }

@app.options("/api/tools")
async def tools_options():
    return {}  # Return empty dict for OPTIONS request

@app.options("/api/agents")
async def agents_options():
    return {}  # Return empty dict for OPTIONS request

@app.options("/api/metrics")
async def metrics_options():
    return {}  # Return empty dict for OPTIONS request

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": config['api']['version']
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.options("/api/health")
async def health_check_options():
    """Handle OPTIONS requests for the health endpoint"""
    return Response(status_code=200)

@app.put("/api/agents/{state}")
async def update_agents_state(state: str):
    """Update all agents to the specified state"""
    try:
        # Validate the state
        valid_statuses = ['active', 'paused', 'idle']
        if state.lower() not in valid_statuses:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid state. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Update all agents
        for agent_id in agents:
            agents[agent_id].status = state.lower()
        
        return {
            "success": True,
            "message": f"Updated all agents to {state.lower()} state",
            "count": len(agents)
        }
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating agent states: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.options("/api/agents/{agent_id}")
async def agent_options():
    """Handle OPTIONS request for agent endpoints"""
    return {}

@app.get("/api/security/events")
async def security_events():
    return {
        "events": [],
        "last_checked": datetime.now().isoformat()
    }

@app.options("/api/security/events")
async def security_events_options():
    return {}

@app.post("/api/agents/{agent_id}/reset")
async def reset_agent_chat(agent_id: str):
    """Reset the chat history for a specific agent"""
    try:
        # Validate agent exists
        if agent_id not in agents:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Remove all messages for this agent
        global messages
        messages = {k: v for k, v in messages.items() if v.agent_id != agent_id}
        
        # Update MCP metrics
        mcp_metrics.update_metrics(agents, messages)
        
        return {
            "status": "success",
            "message": "Chat history cleared"
        }
    except Exception as e:
        logger.error(f"Error resetting chat: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error resetting chat: {str(e)}"
        )

@app.options("/api/agents/{agent_id}/reset")
async def reset_options():
    """Handle OPTIONS request for reset endpoint"""
    return {}

# Agent route endpoint - determines best agent for a message
@app.post("/api/agents/route")
async def route_message(request: RouteRequest):
    message = request.message.lower()
    
    # Simple keyword-based routing logic
    confidence = 0.0
    agent_id = "1"  # Default to Research Assistant
    agent_type = "research"
    reason = "Default agent selection"
    
    # Check for code-related keywords
    code_keywords = ["code", "programming", "bug", "debug", "function", "algorithm", "compiler", "syntax"]
    code_matches = sum(1 for keyword in code_keywords if keyword in message)
    code_confidence = min(0.4 + (code_matches * 0.1), 0.9)  # Cap at 0.9
    
    # Check for writing-related keywords
    writing_keywords = ["write", "edit", "grammar", "sentence", "paragraph", "essay", "content", "proofread"]
    writing_matches = sum(1 for keyword in writing_keywords if keyword in message)
    writing_confidence = min(0.4 + (writing_matches * 0.1), 0.9)  # Cap at 0.9
    
    # Check for research-related keywords
    research_keywords = ["research", "information", "data", "analysis", "study", "find", "search", "learn"]
    research_matches = sum(1 for keyword in research_keywords if keyword in message)
    research_confidence = min(0.4 + (research_matches * 0.1), 0.9)  # Cap at 0.9
    
    # Determine which confidence is highest
    if code_confidence > confidence and code_confidence > writing_confidence and code_confidence > research_confidence:
        confidence = code_confidence
        agent_id = "2"
        agent_type = "code"
        reason = f"Message contains {code_matches} code-related keywords"
    elif writing_confidence > confidence and writing_confidence > code_confidence and writing_confidence > research_confidence:
        confidence = writing_confidence
        agent_id = "3"
        agent_type = "writing"
        reason = f"Message contains {writing_matches} writing-related keywords"
    elif research_confidence > confidence:
        confidence = research_confidence
        agent_id = "1"
        agent_type = "research"
        reason = f"Message contains {research_matches} research-related keywords"
    
    # Log the routing decision
    logger.info(f"Routed message to agent {agent_id} with confidence {confidence:.2f}: {reason}")
    
    return {
        "agentId": agent_id,
        "agentType": agent_type,
        "confidence": confidence,
        "reason": reason
    }

# Agent handoff endpoint
@app.post("/api/agents/handoff")
async def handoff_agent(request: HandoffRequest):
    from_agent_id = request.fromAgentId
    to_agent_id = request.toAgentId
    
    # Validate agent IDs
    if from_agent_id not in agents:
        raise HTTPException(status_code=404, detail=f"Source agent {from_agent_id} not found")
    
    if to_agent_id not in agents:
        raise HTTPException(status_code=404, detail=f"Target agent {to_agent_id} not found")
    
    # Create handoff record
    handoff_id = f"handoff-{int(time.time())}"
    agent_handoffs[handoff_id] = {
        "id": handoff_id,
        "from_agent_id": from_agent_id,
        "to_agent_id": to_agent_id,
        "message": request.message,
        "timestamp": datetime.now().isoformat(),
        "context": request.conversationContext or {}
    }
    
    # If the source agent has an active WebSocket connection
    if from_agent_id in active_connections:
        # Notify the client about the handoff
        await active_connections[from_agent_id].send_json({
            "type": "handoff",
            "from_agent_id": from_agent_id,
            "to_agent_id": to_agent_id,
            "to_agent_name": agents[to_agent_id]["name"],
            "timestamp": datetime.now().isoformat()
        })
    
    # Log the handoff
    logger.info(f"Handoff from agent {from_agent_id} to agent {to_agent_id}")
    
    return {
        "status": "success",
        "handoffId": handoff_id,
        "message": f"Handoff from agent {from_agent_id} to agent {to_agent_id} created"
    }

# Tool endpoints
@app.post("/api/tools/web_search")
async def web_search_endpoint(request: Request):
    try:
        request_data = await request.json()
        result = await process_web_search(request_data)
        return result
    except Exception as e:
        logger.error(f"Error in web search endpoint: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.post("/api/tools/code_analysis")
async def code_analysis_endpoint(request: Request):
    try:
        request_data = await request.json()
        result = await process_code_analysis(request_data)
        return result
    except Exception as e:
        logger.error(f"Error in code analysis endpoint: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.post("/api/tools/text_processing")
async def text_processing_endpoint(request: Request):
    try:
        request_data = await request.json()
        result = await process_text(request_data)
        return result
    except Exception as e:
        logger.error(f"Error in text processing endpoint: {str(e)}")
        return {"error": str(e), "status": "error"}

# Process tool request from WebSocket
async def process_tool_request(tool_request, websocket):
    tool_id = tool_request.get("tool_id")
    tool_name = tool_request.get("tool_name")
    content = tool_request.get("content", "")
    agent_id = tool_request.get("agent_id")
    
    # Find tool by ID or name
    tool = None
    if tool_id and tool_id in tools:
        tool = tools[tool_id]
    elif tool_name:
        for t in tools.values():
            if t["name"].lower() == tool_name.lower() or t["key"] == tool_name.lower():
                tool = t
                break
    
    if not tool:
        return {
            "status": "error",
            "error": f"Tool not found: {tool_id or tool_name}"
        }
    
    logger.info(f"Processing tool request: {tool['name']}")
    
    try:
        result = None
        
        # Extract query/content from the message
        query = content.lower()
        
        # Web Search tool
        if tool["key"] == "web_search":
            # Extract query
            query_match = re.search(r"search (?:for|about) (.+?)(?:\.|$)", content, re.IGNORECASE)
            if not query_match:
                query_match = re.search(r"find information (?:on|about) (.+?)(?:\.|$)", content, re.IGNORECASE)
            
            if query_match:
                query = query_match.group(1).strip()
            else:
                query = content.replace("Please use the Web Search tool to help me with my task.", "").strip()
            
            # Process web search
            result = await process_web_search({"query": query})
            
            # Notify about tool usage
            await websocket.send_json({
                "type": "tool_response",
                "tool_id": tool["id"],
                "tool_name": tool["name"],
                "input": query,
                "result": result.get("result_text", "No results found"),
                "timestamp": datetime.now().isoformat()
            })
        
        # Code Analysis tool
        elif tool["key"] == "code_analysis":
            # Extract code
            code_block_match = re.search(r"```(?:\w*\n)?(.+?)```", content, re.DOTALL)
            
            if code_block_match:
                code = code_block_match.group(1).strip()
                language = ""
                
                # Try to detect language from opening ```
                lang_match = re.search(r"```(\w+)", content)
                if lang_match:
                    language = lang_match.group(1).lower()
                
                # Process code analysis
                result = await process_code_analysis({
                    "code": code,
                    "language": language
                })
                
                # Notify about tool usage
                await websocket.send_json({
                    "type": "tool_response",
                    "tool_id": tool["id"],
                    "tool_name": tool["name"],
                    "input": f"Code analysis ({language})",
                    "result": result.get("result_text", "No issues found"),
                    "timestamp": datetime.now().isoformat()
                })
            else:
                # No code block found
                await websocket.send_json({
                    "type": "tool_response",
                    "tool_id": tool["id"],
                    "tool_name": tool["name"],
                    "input": "Code analysis request",
                    "result": "No code block was provided. Please include your code between triple backticks (```code```).",
                    "timestamp": datetime.now().isoformat()
                })
        
        # Text Processing tool
        elif tool["key"] == "text_processing":
            # Determine operation (sentiment, grammar, summarize)
            operation = "summarize"  # Default operation
            
            if "sentiment" in content.lower() or "analyze sentiment" in content.lower():
                operation = "sentiment"
            elif "grammar" in content.lower() or "check grammar" in content.lower():
                operation = "grammar"
            elif "summarize" in content.lower() or "summary" in content.lower():
                operation = "summarize"
            
            # Extract text to process
            text_block_match = re.search(r"```(.+?)```", content, re.DOTALL)
            if text_block_match:
                text = text_block_match.group(1).strip()
            else:
                # Try to extract text without code blocks
                text = content.replace("Please use the Text Processing tool to help me with my task.", "").strip()
            
            # Process text
            result = await process_text({
                "text": text,
                "operation": operation
            })
            
            # Notify about tool usage
            await websocket.send_json({
                "type": "tool_response",
                "tool_id": tool["id"],
                "tool_name": tool["name"],
                "input": f"Text {operation} request",
                "result": result.get("result_text", "No results available"),
                "timestamp": datetime.now().isoformat()
            })
        
        else:
            # Unknown tool
            await websocket.send_json({
                "type": "error",
                "content": f"Tool {tool['name']} is not implemented yet",
                "timestamp": datetime.now().isoformat()
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing tool request: {str(e)}")
        
        await websocket.send_json({
            "type": "error",
            "content": f"Error using tool {tool['name']}: {str(e)}",
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "status": "error",
            "error": str(e)
        }

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Initialize database
        init_db()
        logger.info("Database initialized successfully")
        
        # Initialize sample data
        await initialize_sample_data()
        logger.info("Sample data initialized successfully")
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise

async def process_agent_request(agent_id: str, message: str, conversation_id: str, history: List[Dict], files: Optional[List[FileData]] = None) -> Dict[str, Any]:
    """Process the user request using real agent logic with LangChain."""
    try:
        logger.info(f"[Agent Process] START - Agent: {agent_id}, Conversation: {conversation_id}")
        
        # Initialize response structure with properly formatted reasoning steps
        response = {
            "reply": "",
            "reasoning": [],
            "tool_usage": []
        }
        
        # Basic input validation
        if not message or len(message.strip()) == 0:
            response["reply"] = "I'm here to help! What would you like to discuss?"
            response["reasoning"] = [
                ReasoningStep(
                    description="Received empty message, responding with greeting",
                    type="thinking"
                )
            ]
            # Add conversation_id before returning
            response["conversation_id"] = conversation_id
            return response
            
        # Process files if present
        if files:
            for file in files:
                logger.info(f"Processing file: {file.filename}")
                response["reasoning"].append(
                    ReasoningStep(
                        description=f"Processing attached file: {file.filename}",
                        type="thinking"
                    )
                )
                
        # Get agent configuration
        agent = agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
            
        # Process based on agent role
        logger.info(f"[Agent Process] Processing request using {agent.role}")
        
        # Add initial processing step
        response["reasoning"].append(
            ReasoningStep(
                description=f"Processing request using {agent.role} capabilities",
                type="thinking"
            )
        )
        
        # Generate response based on agent role
        # --- Start Original Code (Commented Out) ---
        # if agent.role == "researcher":
        #     response["reasoning"].append(
        #         ReasoningStep(
        #             description="Analyzing query for research requirements and formulating response",
        #             type="thinking"
        #         )
        #     )
        #     response["reply"] = "I am Research Assistant, how can I help with your research?"
        #     
        # elif agent.role == "coder":
        #     response["reasoning"].append(
        #         ReasoningStep(
        #             description="Analyzing query for coding assistance and preparing response",
        #             type="thinking"
        #         )
        #     )
        #     response["reply"] = "I am Code Assistant, how can I help with your code?"
        #     
        # else:
        #     response["reasoning"].append(
        #         ReasoningStep(
        #             description="Generating general assistance response based on user query",
        #             type="thinking"
        #         )
        #     )
        #     response["reply"] = "I am AI Assistant, how can I assist you?"
        # --- End Original Code ---
        
        # --- Start New Code (Echo Response) ---
        # Placeholder: Echo the received message for now.
        # TODO: Replace this with actual agent logic (e.g., LLM call)
        response["reply"] = f"Received your message: '{message}'"
        response["reasoning"].append(
            ReasoningStep(
                description=f"Echoing user message: '{message}'",
                type="thinking"
            )
        )
        # --- End New Code ---
        
        # Add final processing step
        response["reasoning"].append(
            ReasoningStep(
                description="Generated and validated response for user query",
                type="thinking"
            )
        )
        
        # Log the response for debugging
        logger.info(f"[Agent Process] Generated response: {response['reply']}")
        
        # Add conversation_id before returning
        response["conversation_id"] = conversation_id
        response["agent_id"] = agent_id

        # Broadcast the response through websocket if available
        await broadcast_response(agent_id, message, response)
        
        return response
        
    except Exception as e:
        logger.error(f"Error in process_agent_request: {str(e)}")
        # Return a dictionary compatible with ChatResponse even on error
        return {
            "reply": f"Error processing request: {str(e)}",
            "reasoning": [
                ReasoningStep(
                    description=f"Error occurred while processing request: {str(e)}",
                    type="error"
                ).dict()
            ],
            "tool_usage": [],
            "conversation_id": conversation_id,
            "agent_id": agent_id
        }

if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="Run the FastAPI backend server.")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind the server to.")
    parser.add_argument("--port", type=int, default=5001, help="Port to bind the server to.")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload.")
    parser.add_argument("--no-reload", dest="reload", action="store_false", help="Disable auto-reload.")
    parser.set_defaults(reload=False) # Default is no reload unless --reload is specified

    args = parser.parse_args()

    # Ensure log directory exists if file logging is enabled
    # Note: Assuming config is loaded before this point if file logging path depends on it.
    # If not, this logic might need adjustment or placement after config load.
    # Example: Check if config['logging']['handlers']['file']['enabled'] and create dir if needed

    print(f"Starting server on {args.host}:{args.port} with reload={'enabled' if args.reload else 'disabled'}")
    uvicorn.run("main:app", host=args.host, port=args.port, reload=args.reload) 