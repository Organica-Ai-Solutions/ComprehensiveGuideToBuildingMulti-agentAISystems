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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agent System", version="1.0.0")

# Add security headers
API_KEY = APIKeyHeader(name="X-API-Key", auto_error=False)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "http://localhost:58957", "http://127.0.0.1:3000", "http://127.0.0.1:58957"],  # Allow multiple frontend origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Load environment variables
load_dotenv()  # Looks for .env in current directory

# Access variables like this:
openai_key = os.getenv("OPENAI_API_KEY")

# In-memory storage
agents = {}
messages = {}
tools = {}
metrics = []
active_connections = {}

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
            if not self.active_connections[agent_id]:
                del self.active_connections[agent_id]

    async def broadcast(self, message: dict, agent_id: str):
        if agent_id in self.active_connections:
            for connection in self.active_connections[agent_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {str(e)}")
                    await self.handle_failed_connection(connection, agent_id)

    async def handle_failed_connection(self, websocket: WebSocket, agent_id: str):
        try:
            await websocket.close()
        except Exception:
            pass
        self.disconnect(websocket, agent_id)

manager = ConnectionManager()

# Initialize sample data
def initialize_sample_data():
    # Sample agents
    sample_agents = [
        {
            'id': '1',
            'name': 'Research Assistant',
            'role': 'Academic Research',
            'goal': 'Help with research tasks and literature review',
            'capabilities': ['Literature Review', 'Data Analysis', 'Citation Management'],
            'status': 'active',
            'created_at': datetime.now()
        },
        {
            'id': '2',
            'name': 'Code Helper',
            'role': 'Programming Assistant',
            'goal': 'Assist with coding tasks and debugging',
            'capabilities': ['Code Review', 'Debugging', 'Best Practices'],
            'status': 'active',
            'created_at': datetime.now()
        },
        {
            'id': '3',
            'name': 'Writing Assistant',
            'role': 'Content Creation',
            'goal': 'Help with writing and editing tasks',
            'capabilities': ['Grammar Check', 'Style Editing', 'Content Planning'],
            'status': 'idle',
            'created_at': datetime.now()
        }
    ]

    # Sample tools
    sample_tools = [
        {
            'id': '1',
            'name': 'Web Search',
            'description': 'Search the web for information',
            'api_endpoint': '/api/tools/search',
            'available': True,
            'created_at': datetime.now()
        },
        {
            'id': '2',
            'name': 'Code Analysis',
            'description': 'Analyze code for bugs and optimizations',
            'api_endpoint': '/api/tools/code',
            'available': True,
            'created_at': datetime.now()
        },
        {
            'id': '3',
            'name': 'Text Processing',
            'description': 'Analyze, summarize, or translate text',
            'api_endpoint': '/api/tools/text',
            'available': True,
            'created_at': datetime.now()
        }
    ]

    # Initialize the in-memory storage
    for agent in sample_agents:
        agents[agent['id']] = Agent(**agent)
    
    for tool in sample_tools:
        tools[tool['id']] = Tool(**tool)

    print("Sample data initialized")

# Initialize data on startup
@app.on_event("startup")
async def startup_event():
    initialize_sample_data()

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
    """Process incoming WebSocket message"""
    try:
        if 'type' not in data:
            raise ValueError("Message must include a 'type' field")

        if data['type'] == 'message':
            if 'content' not in data:
                raise ValueError("Message type 'message' must include 'content'")

            # Create user message
            msg_id = str(len(messages) + 1)
            user_msg = MessageInDB(
                id=msg_id,
                agent_id=agent_id,
                content=data['content'],
                sender=data.get('sender', 'user'),
                timestamp=datetime.now(),
                token_count=len(data['content'].split()),
                message_type='text',
                status='success'
            )
            messages[msg_id] = user_msg

            # Get agent details
            agent = agents.get(agent_id)
            if not agent:
                raise ValueError(f"Agent {agent_id} not found")

            # Generate response based on agent role
            response_content = generate_agent_response(agent, data['content'])
            
            response_id = str(len(messages) + 1)
            agent_msg = MessageInDB(
                id=response_id,
                agent_id=agent_id,
                content=response_content,
                sender='agent',
                timestamp=datetime.now(),
                token_count=len(response_content.split()),
                message_type='text',
                status='success'
            )
            messages[response_id] = agent_msg

            # Broadcast the response to all connected clients
            response = {
                'type': 'message',
                'content': response_content,
                'timestamp': datetime.now().isoformat(),
                'status': 'success',
                'sender': 'agent',
                'agent_name': agent.name
            }
            await manager.broadcast(response, agent_id)

            return response

        elif data['type'] == 'typing':
            # Handle typing indicators
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
    await manager.connect(websocket, agent_id)
    try:
        while True:
            data = await websocket.receive_json()
            await process_message(agent_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, agent_id)
    except JSONDecodeError:
        error_msg = {
            'type': 'error',
            'content': 'Invalid JSON format in message',
            'timestamp': datetime.now().isoformat(),
            'error_code': 'INVALID_JSON'
        }
        await websocket.send_json(error_msg)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await websocket.close()
        manager.disconnect(websocket, agent_id)

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
    """Get system metrics for the dashboard"""
    active_agent_count = sum(1 for agent in agents.values() if agent.status == 'active')
    
    # Calculate basic metrics
    total_messages = len(messages)
    recent_messages = sum(1 for msg in messages.values() 
                         if (datetime.now() - msg.timestamp).total_seconds() < 3600)
    
    return {
        "active_agents": active_agent_count,
        "total_messages": total_messages,
        "recent_messages": recent_messages,
        "system_load": psutil.cpu_percent(),
        "memory_usage": psutil.virtual_memory().percent
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

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000) 