from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
import uuid
import httpx
import asyncio
import time
from datetime import datetime

# --- Constants ---
SERVICE_ENDPOINTS = {
    "memory_vector": "http://localhost:8002",
    "memory_kv": "http://localhost:8003",
    "memory_document": "http://localhost:8004",
    "llm_proxy": "http://localhost:8020",
}

# --- FastAPI App ---
app = FastAPI(
    title="Agent Orchestration Service",
    description="Manages agent tasks and coordination",
    version="0.1.0"
)

# --- Models ---
class AgentRole(str, Enum):
    PLANNER = "planner"
    RESEARCHER = "researcher"
    WRITER = "writer"
    CODER = "coder"
    CRITIC = "critic"

class AgentStatus(str, Enum):
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"

class Agent(BaseModel):
    id: str
    name: str
    role: AgentRole
    description: str
    status: AgentStatus = AgentStatus.IDLE
    capabilities: List[str] = Field(default_factory=list)

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskCreate(BaseModel):
    title: str
    description: str
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_agents: List[str] = Field(default_factory=list)
    context: Optional[Dict[str, Any]] = None

class Task(TaskCreate):
    id: str
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime
    updated_at: datetime
    result: Optional[Any] = None

class HealthResponse(BaseModel):
    status: str

# --- In-memory storage (replace with database in production) ---
agents: Dict[str, Agent] = {}
tasks: Dict[str, Task] = {}

# --- Initialize with some default agents ---
def initialize_agents():
    default_agents = [
        Agent(
            id=str(uuid.uuid4()),
            name="Planner Agent",
            role=AgentRole.PLANNER,
            description="Coordinates tasks and creates plans",
            capabilities=["task_decomposition", "goal_planning"]
        ),
        Agent(
            id=str(uuid.uuid4()),
            name="Research Agent",
            role=AgentRole.RESEARCHER,
            description="Gathers information from various sources",
            capabilities=["web_search", "document_analysis"]
        ),
        Agent(
            id=str(uuid.uuid4()),
            name="Writer Agent",
            role=AgentRole.WRITER,
            description="Creates written content",
            capabilities=["content_creation", "summarization"]
        ),
        Agent(
            id=str(uuid.uuid4()),
            name="Code Agent",
            role=AgentRole.CODER,
            description="Writes and reviews code",
            capabilities=["code_generation", "code_analysis"]
        ),
        Agent(
            id=str(uuid.uuid4()),
            name="Critic Agent",
            role=AgentRole.CRITIC,
            description="Reviews and provides feedback",
            capabilities=["quality_assessment", "factual_verification"]
        ),
    ]
    
    for agent in default_agents:
        agents[agent.id] = agent

# Call initialization on startup
initialize_agents()

# --- Routes ---
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check the health of the service"""
    return {"status": "operational"}

@app.get("/agents", response_model=List[Agent])
async def get_agents():
    """Get all available agents"""
    return list(agents.values())

@app.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    """Get a specific agent by ID"""
    if agent_id not in agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with ID {agent_id} not found"
        )
    return agents[agent_id]

@app.post("/agents", response_model=Agent)
async def create_agent(agent: Agent):
    """Create a new agent"""
    if agent.id in agents:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent with ID {agent.id} already exists"
        )
    agents[agent.id] = agent
    return agent

@app.get("/tasks", response_model=List[Task])
async def get_tasks():
    """Get all tasks"""
    return list(tasks.values())

@app.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task by ID"""
    if task_id not in tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    return tasks[task_id]

@app.post("/tasks", response_model=Task)
async def create_task(task_create: TaskCreate):
    """Create a new task"""
    # Validate assigned agents
    for agent_id in task_create.assigned_agents:
        if agent_id not in agents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent with ID {agent_id} not found"
            )
    
    task_id = str(uuid.uuid4())
    now = datetime.now()
    
    # Create the task
    task = Task(
        id=task_id,
        title=task_create.title,
        description=task_create.description,
        priority=task_create.priority,
        assigned_agents=task_create.assigned_agents,
        context=task_create.context or {},
        status=TaskStatus.PENDING,
        created_at=now,
        updated_at=now,
    )
    tasks[task_id] = task
    
    # Update agent statuses
    for agent_id in task.assigned_agents:
        agents[agent_id].status = AgentStatus.WORKING
    
    # Start task execution asynchronously
    asyncio.create_task(execute_task(task_id))
    
    return task

@app.put("/tasks/{task_id}/cancel", response_model=Task)
async def cancel_task(task_id: str):
    """Cancel a task"""
    if task_id not in tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
    
    task = tasks[task_id]
    if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task is already in {task.status} state and cannot be cancelled"
        )
    
    task.status = TaskStatus.FAILED
    task.updated_at = datetime.now()
    
    # Reset agent statuses
    for agent_id in task.assigned_agents:
        agents[agent_id].status = AgentStatus.IDLE
    
    return task

# --- Task Execution Logic ---
async def execute_task(task_id: str):
    """Execute a task using assigned agents"""
    task = tasks[task_id]
    task.status = TaskStatus.IN_PROGRESS
    task.updated_at = datetime.now()
    
    try:
        # In a real implementation, this would involve:
        # 1. Sending requests to the LLM Proxy service to get agent responses
        # 2. Storing intermediary results in memory services
        # 3. Coordinating between agents based on the task requirements
        
        # For now, we'll just simulate task execution with a delay
        await asyncio.sleep(5)  # Simulate work
        
        # Update task result
        task.result = {
            "summary": f"Completed task: {task.title}",
            "details": "This is a simulated task execution result."
        }
        task.status = TaskStatus.COMPLETED
    except Exception as e:
        task.status = TaskStatus.FAILED
        task.result = {"error": str(e)}
    
    # Update task and reset agent statuses
    task.updated_at = datetime.now()
    for agent_id in task.assigned_agents:
        agents[agent_id].status = AgentStatus.IDLE
    
    # Store task result in document store
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SERVICE_ENDPOINTS['memory_document']}/documents",
                json={
                    "content_type": "task_result",
                    "content": task.result,
                    "metadata": {
                        "task_id": task.id,
                        "title": task.title,
                        "status": task.status
                    }
                }
            )
    except Exception:
        # Log error but don't fail the task
        pass

# --- Run with Uvicorn ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 