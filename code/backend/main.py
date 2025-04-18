from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, Body, Depends, Request, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.websockets import WebSocketState
from pydantic import BaseModel
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

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI application"""
    # Startup
    logger.info("Initializing application...")
    initialize_sample_data()
    logger.info("Application initialized")
    yield
    # Shutdown
    logger.info("Shutting down application...")

app = FastAPI(
    title="Agent System",
    version=config['api']['version'],
    lifespan=lifespan
)

# Add security headers
API_KEY = APIKeyHeader(name="X-API-Key", auto_error=False)

# Configure CORS from config
app.add_middleware(
    CORSMiddleware,
    allow_origins=config['api']['allowed_origins'],
    allow_credentials=config['api']['cors_settings']['allow_credentials'],
    allow_methods=config['api']['cors_settings']['allow_methods'],
    allow_headers=config['api']['cors_settings']['allow_headers'],
    max_age=config['api']['cors_settings']['max_age'],
)

# Load environment variables
load_dotenv()

# Access variables like this:
openai_key = os.getenv("OPENAI_API_KEY")

# In-memory storage
agents = {}
messages = {}
tools = {}
metrics = []
active_connections = {}
conversation_history = {}
agent_handoffs = {}

# System configuration
context_history = []
MAX_CONTEXT_SIZE = config['system']['max_context_size']
MAX_MESSAGE_LENGTH = config['system']['max_message_length']
MAX_CONVERSATION_HISTORY = config['system']['max_conversation_history']

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

# Initialize MCP metrics
mcp_metrics = MCPMetrics()

# Model classes
class Agent(BaseModel):
    id: str
    name: str
    role: str
    goal: str
    capabilities: List[str]
    status: str
    created_at: Optional[datetime] = None

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
    step_number: int
    content: str

class EnhancedResponse(BaseModel):
    content: str
    reasoning_steps: List[ReasoningStep]

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, agent_id: str):
        await websocket.accept()
        if agent_id not in self.active_connections:
            self.active_connections[agent_id] = []
        self.active_connections[agent_id].append(websocket)
        logger.info(f"New WebSocket connection established for agent {agent_id}. Total connections: {len(self.active_connections[agent_id])}")
        # Send welcome message
        await websocket.send_json({
            'type': 'system',
            'content': f'Connected to {agents[agent_id].name if agent_id in agents else "Unknown Agent"}',
            'timestamp': datetime.now().isoformat(),
            'status': 'success'
        })

    def disconnect(self, websocket: WebSocket, agent_id: str):
        if agent_id in self.active_connections:
            self.active_connections[agent_id].remove(websocket)
            logger.info(f"WebSocket connection closed for agent {agent_id}. Remaining connections: {len(self.active_connections[agent_id])}")
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]
                logger.info(f"No more connections for agent {agent_id}, removing from active connections")

    async def broadcast(self, message: dict, agent_id: str):
        if agent_id in self.active_connections:
            logger.info(f"Broadcasting message to {len(self.active_connections[agent_id])} connection(s) for agent {agent_id}")
            for connection in self.active_connections[agent_id]:
                try:
                    await connection.send_json(message)
                    logger.info(f"Successfully sent message to connection for agent {agent_id}")
                except Exception as e:
                    logger.error(f"Error broadcasting message: {str(e)}")
                    await self.handle_failed_connection(connection, agent_id)
        else:
            logger.warning(f"No active connections found for agent {agent_id}")

    async def handle_failed_connection(self, websocket: WebSocket, agent_id: str):
        logger.warning(f"Handling failed connection for agent {agent_id}")
        try:
            await websocket.close()
        except Exception as e:
            logger.error(f"Error closing failed connection: {str(e)}")
        self.disconnect(websocket, agent_id)

manager = ConnectionManager()

# Initialize sample data
def initialize_sample_data():
    """Initialize sample agents and tools from configuration"""
    try:
        # Initialize agents based on configured roles
        agent_roles = config['agents']['roles']
        for role_id, role_config in agent_roles.items():
            try:
                agent_id = f"{role_id}_agent"
                agent = Agent(
                    id=agent_id,
                    name=role_id.capitalize(),
                    role=role_id,
                    goal=role_config['goal'],
                    capabilities=role_config['capabilities'],
                    status="active",
                    created_at=datetime.now()
                )
                agents[agent_id] = agent
                conversation_history[agent_id] = []
                logger.info(f"Initialized agent: {agent_id}")
            except Exception as e:
                logger.error(f"Error initializing agent {role_id}: {str(e)}")
                continue

        # Initialize tools based on configuration
        tools_config = config['tools']
        for tool_id, tool_config in tools_config.items():
            try:
                tool = Tool(
                    id=tool_id,
                    name=tool_id,
                    description=f"Tool for {tool_id}",
                    api_endpoint=tool_config['endpoint'],
                    available=True,
                    created_at=datetime.now()
                )
                tools[tool_id] = tool
                logger.info(f"Initialized tool: {tool_id}")
            except Exception as e:
                logger.error(f"Error initializing tool {tool_id}: {str(e)}")
                continue

        logger.info(f"Initialized {len(agents)} agents and {len(tools)} tools")
    except Exception as e:
        logger.error(f"Error in initialize_sample_data: {str(e)}")
        raise

# API Endpoints
@app.get("/api/agents")
@app.head("/api/agents")
async def get_agents(api_key: str = Depends(API_KEY)):
    return list(agents.values())

@app.get("/api/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agents[agent_id]

@app.get("/api/tools", response_model=List[Tool])
@app.head("/api/tools")
async def get_tools():
    return list(tools.values())

@app.get("/api/agents/{agent_id}/messages", response_model=List[MessageInDB])
async def get_agent_messages(agent_id: str):
    agent_messages = [msg for msg in messages.values() if msg.agent_id == agent_id]
    return sorted(agent_messages, key=lambda x: x.timestamp)

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

            # Create reasoning steps
            reasoning_steps = [
                {
                    'step_number': 1,
                    'content': 'Received and processed user input'
                },
                {
                    'step_number': 2,
                    'content': f'Generated response based on {agent.role} capabilities'
                }
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
                    'reasoning_steps': reasoning_steps,
                    'total_tokens': mcp_metrics.total_tokens,
                    'max_tokens': mcp_metrics.max_tokens
                }
            }
            logger.info(f"Broadcasting response: {response}")
            await manager.broadcast(response, agent_id)
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
        await manager.broadcast(error_response, agent_id)
        return error_response

    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        error_response = {
            'type': 'error',
            'content': "An error occurred while processing your message",
            'timestamp': datetime.now().isoformat(),
            'error_code': 'PROCESSING_ERROR'
        }
        await manager.broadcast(error_response, agent_id)
        return error_response

def generate_agent_response(agent: Agent, user_message: str) -> str:
    try:
        # Basic response generation based on agent role
        responses = {
            "Academic Research": f"As a Research Assistant, I can help you with: {', '.join(agent.capabilities)}. How can I assist with your research?",
            "Programming Assistant": f"I'm your Code Helper with expertise in: {', '.join(agent.capabilities)}. What coding challenge can I help you with?",
            "Content Creation": f"As a Writing Assistant, I specialize in: {', '.join(agent.capabilities)}. How can I help improve your writing?"
        }
        
        return responses.get(agent.role, f"I am {agent.name}, how can I assist you?")
        
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return "I apologize, but I'm having trouble processing your request at the moment. Could you please try again?"

@app.websocket("/ws/{agent_id}")
async def websocket_endpoint(websocket: WebSocket, agent_id: str):
    await websocket.accept()
    
    if agent_id not in agents:
        await websocket.send_json({"type": "error", "content": "Agent not found"})
        await websocket.close()
        return
    
    active_connections[agent_id] = websocket
    
    try:
        # Send system message on connection
        await websocket.send_json({
            "type": "system",
            "content": f"Connected to {agents[agent_id]['name']}",
            "timestamp": datetime.now().isoformat(),
            "status": "success"
        })
        
        # Initialize conversation history if not exists
        if agent_id not in conversation_history:
            conversation_history[agent_id] = []
        
        # Process messages
        async for data in websocket.iter_json():
            message_type = data.get("type", "")
            
            if message_type == "message":
                # User message to agent
                content = data.get("content", "")
                
                # Save user message to history
                conversation_history[agent_id].append({
                    "sender": "user",
                    "content": content,
                    "timestamp": datetime.now().isoformat()
                })
                
                # Simulate thinking
                await websocket.send_json({
                    "type": "thinking",
                    "timestamp": datetime.now().isoformat()
                })
                
                # Simulate delay for agent response
                await asyncio.sleep(random.uniform(0.5, 2.0))
                
                # Check if the message is asking to use a tool
                if "please use the" in content.lower() and "tool" in content.lower():
                    tool_match = re.search(r"please use the (.*?) tool", content, re.IGNORECASE)
                    if tool_match:
                        tool_name = tool_match.group(1).strip()
                        logger.info(f"Tool request detected: {tool_name}")
                        
                        # Find the tool
                        tool = None
                        for t in tools.values():
                            if t["name"].lower() == tool_name.lower():
                                tool = t
                                break
                        
                        if tool:
                            # Process tool request
                            await process_tool_request({
                                "tool_id": tool["id"],
                                "tool_name": tool["name"],
                                "content": content,
                                "agent_id": agent_id
                            }, websocket)
                            
                            # Add reasoning steps about tool usage
                            await websocket.send_json({
                                "type": "reasoning",
                                "steps": [
                                    f"Identified request to use the {tool['name']} tool",
                                    f"Extracted necessary information from the request",
                                    f"Processed the request with the {tool['name']} tool"
                                ],
                                "timestamp": datetime.now().isoformat()
                            })
                            
                            # Send agent response about tool results
                            agent_response = f"I've used the {tool['name']} tool to help with your request. The results are shown above."
                            
                            await websocket.send_json({
                                "type": "agent_message",
                                "content": agent_response,
                                "timestamp": datetime.now().isoformat(),
                                "status": "success",
                                "sender": "agent",
                                "agent_name": agents[agent_id]["name"],
                                "token_count": len(agent_response.split())
                            })
                            
                            # Save agent response to history
                            conversation_history[agent_id].append({
                                "sender": "agent",
                                "content": agent_response,
                                "timestamp": datetime.now().isoformat()
                            })
                            
                            continue
                
                # Send default agent response
                agent_response = agents[agent_id]["default_response"]
                
                await websocket.send_json({
                    "type": "agent_message",
                    "content": agent_response,
                    "timestamp": datetime.now().isoformat(),
                    "status": "success",
                    "sender": "agent",
                    "agent_name": agents[agent_id]["name"],
                    "token_count": len(agent_response.split())
                })
                
                # Save agent response to history
                conversation_history[agent_id].append({
                    "sender": "agent",
                    "content": agent_response,
                    "timestamp": datetime.now().isoformat()
                })
                
            elif message_type == "tool_request":
                # Direct request to use a tool
                await process_tool_request(data, websocket)
    
    except WebSocketDisconnect:
        if agent_id in active_connections:
            del active_connections[agent_id]
        logger.info(f"WebSocket disconnected for agent {agent_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error for agent {agent_id}: {str(e)}")
        if agent_id in active_connections:
            del active_connections[agent_id]

@app.options("/api/agents/{agent_id}/messages")
async def messages_options():
    return {}  # Return empty dict for OPTIONS request

class MessageRequest(BaseModel):
    content: str
    sender: str = "user"

@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
    agent_id: str,
    payload: Dict[str, Any]
):
    try:
        # Validate agent exists
        if agent_id not in agents:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Validate payload
        if "content" not in payload:
            raise HTTPException(status_code=400, detail="Message content is required")

        # Generate agent response
        agent = agents[agent_id]
        response_content = generate_agent_response(agent, payload["content"])

        # Create reasoning steps
        reasoning_steps = [
            ReasoningStep(step_number=1, content="Processed user message"),
            ReasoningStep(step_number=2, content="Generated response based on agent role and capabilities")
        ]

        return {
            "content": response_content,
            "reasoning_steps": reasoning_steps
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )

@app.get("/api/metrics")
async def get_metrics():
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
    try:
        process = psutil.Process()
        start_time = datetime.fromtimestamp(process.create_time())
        uptime = (datetime.now() - start_time).total_seconds()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": config['api']['version'],
            "uptime": uptime,
            "environment": "development"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.options("/api/health")
async def health_check_options():
    return {}

@app.put("/api/agents/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, update_data: dict = Body(...)):
    """Update agent properties"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get the current agent data
    agent = agents[agent_id]
    
    # Update only the allowed fields
    if "status" in update_data:
        if update_data["status"] not in ["active", "idle"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
        agent.status = update_data["status"]
    
    # Return the updated agent
    return agent

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

# Initialize sample data on startup
@app.on_event("startup")
async def startup_event():
    initialize_sample_data()
    logger.info("Application startup complete")

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000) 