from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
import httpx
import os
import json
import asyncio
from enum import Enum
import time
import uuid

# --- Constants ---
# Default to OpenAI, but could be configured to use other providers
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# --- FastAPI App ---
app = FastAPI(
    title="LLM Proxy Service",
    description="Proxy service for LLM API calls",
    version="0.1.0"
)

# --- Models ---
class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"

class LLMModel(str, Enum):
    GPT_3_5 = "gpt-3.5-turbo"
    GPT_4 = "gpt-4"
    GPT_4_TURBO = "gpt-4-turbo-preview"
    CLAUDE_2 = "claude-2"
    CLAUDE_3_OPUS = "claude-3-opus"
    CLAUDE_3_SONNET = "claude-3-sonnet"
    CLAUDE_3_HAIKU = "claude-3-haiku"

class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"
    TOOL = "tool"

class Message(BaseModel):
    role: MessageRole
    content: str
    name: Optional[str] = None

class FunctionCall(BaseModel):
    name: str
    arguments: str

class FunctionDefinition(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Dict[str, Any]

class ToolCall(BaseModel):
    id: str
    type: str = "function"
    function: FunctionCall

class Tool(BaseModel):
    type: str = "function"
    function: FunctionDefinition

class CompletionRequest(BaseModel):
    model: LLMModel
    messages: List[Message]
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    provider: Optional[LLMProvider] = None
    tools: Optional[List[Tool]] = None
    stream: bool = False
    request_id: Optional[str] = None

class CompletionResponse(BaseModel):
    id: str
    model: str
    provider: LLMProvider
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    created: int
    tool_calls: Optional[List[ToolCall]] = None

class HealthResponse(BaseModel):
    status: str
    providers: Dict[str, bool]

# --- In-memory caching ---
completion_cache: Dict[str, CompletionResponse] = {}
task_results: Dict[str, Any] = {}

# --- Health Check ---
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check the health of the service and LLM providers"""
    providers_status = {
        "openai": bool(OPENAI_API_KEY),
        "anthropic": bool(ANTHROPIC_API_KEY),
        "azure_openai": False  # Not implemented yet
    }
    
    return {
        "status": "operational",
        "providers": providers_status
    }

# --- LLM Completion Endpoint ---
@app.post("/completions", response_model=CompletionResponse)
async def create_completion(request: CompletionRequest, background_tasks: BackgroundTasks):
    """Generate a completion from an LLM"""
    # Generate a request ID if not provided
    request_id = request.request_id or str(uuid.uuid4())
    
    # Check if result is cached (for non-streaming requests)
    if not request.stream and request_id in completion_cache:
        return completion_cache[request_id]
    
    # Determine provider (use request provider or default)
    provider = request.provider or LLM_PROVIDER
    
    # For streaming requests, process in background and return task ID
    if request.stream:
        background_tasks.add_task(process_streaming_completion, request, request_id)
        return {
            "id": request_id,
            "model": request.model,
            "provider": provider,
            "choices": [],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "created": int(time.time())
        }
    
    # For non-streaming, process directly
    result = await process_completion(request, provider)
    
    # Cache the result
    completion_cache[request_id] = result
    
    return result

@app.get("/completions/{request_id}/stream")
async def stream_completion(request_id: str):
    """Get streaming completion results"""
    if request_id not in task_results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No streaming task found with ID {request_id}"
        )
    
    # This would be implemented with Server-Sent Events (SSE) in a real application
    # For now, we'll just return the current state
    return task_results[request_id]

# --- Prompt Templates ---
@app.get("/prompts/templates")
async def get_prompt_templates():
    """Get available prompt templates"""
    # In a real application, these would be stored in a database or loaded from files
    return {
        "agent_task": {
            "description": "Template for agent tasks",
            "template": "You are a {role} agent. Your task is to {task}. {additional_context}"
        },
        "react_agent": {
            "description": "Template for ReAct agents",
            "template": "You are a problem-solving agent. Solve the following task step by step:\n\nTask: {task}\n\nThink through this problem step by step. For each step:\n1. Think about what you know and what you need to find out\n2. Decide on an action to take\n3. Execute the action\n4. Observe the result\n5. Incorporate the new information\n\nAvailable tools: {tools}"
        }
    }

# --- Helper Functions ---
async def process_completion(request: CompletionRequest, provider: str) -> CompletionResponse:
    """Process a completion request based on the provider"""
    if provider == LLMProvider.OPENAI:
        return await process_openai_completion(request)
    elif provider == LLMProvider.ANTHROPIC:
        return await process_anthropic_completion(request)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}"
        )

async def process_openai_completion(request: CompletionRequest) -> CompletionResponse:
    """Process a completion request using OpenAI API"""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured"
        )
    
    # Prepare the request payload
    payload = {
        "model": request.model,
        "messages": [msg.dict() for msg in request.messages],
        "temperature": request.temperature,
    }
    
    if request.max_tokens:
        payload["max_tokens"] = request.max_tokens
    
    if request.tools:
        payload["tools"] = [tool.dict() for tool in request.tools]
    
    # Call the OpenAI API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"OpenAI API error: {response.text}"
                )
            
            data = response.json()
            
            # Format the response
            result = {
                "id": data["id"],
                "model": data["model"],
                "provider": LLMProvider.OPENAI,
                "choices": data["choices"],
                "usage": data["usage"],
                "created": data["created"]
            }
            
            # Add tool calls if present
            if "tool_calls" in data.get("choices", [{}])[0].get("message", {}):
                result["tool_calls"] = data["choices"][0]["message"]["tool_calls"]
            
            return result
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error communicating with OpenAI API: {str(e)}"
        )

async def process_anthropic_completion(request: CompletionRequest) -> CompletionResponse:
    """Process a completion request using Anthropic API"""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Anthropic API key not configured"
        )
    
    # Convert messages format for Anthropic API
    anthropic_messages = []
    system_message = None
    
    for msg in request.messages:
        if msg.role == MessageRole.SYSTEM:
            system_message = msg.content
        else:
            anthropic_messages.append({
                "role": "assistant" if msg.role == MessageRole.ASSISTANT else "user",
                "content": msg.content
            })
    
    # Prepare the request payload
    payload = {
        "model": request.model,
        "messages": anthropic_messages,
        "temperature": request.temperature,
    }
    
    if system_message:
        payload["system"] = system_message
    
    if request.max_tokens:
        payload["max_tokens"] = request.max_tokens
    
    # TODO: Add tool calls support for Anthropic
    
    # Call the Anthropic API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Anthropic API error: {response.text}"
                )
            
            data = response.json()
            
            # Format the response to match our standard format
            result = {
                "id": data.get("id", str(uuid.uuid4())),
                "model": request.model,
                "provider": LLMProvider.ANTHROPIC,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": data.get("content", [{"text": ""}])[0].get("text", "")
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": data.get("usage", {}).get("input_tokens", 0),
                    "completion_tokens": data.get("usage", {}).get("output_tokens", 0),
                    "total_tokens": data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)
                },
                "created": int(time.time())
            }
            
            return result
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error communicating with Anthropic API: {str(e)}"
        )

async def process_streaming_completion(request: CompletionRequest, request_id: str):
    """Process a streaming completion request in the background"""
    # Initialize task result
    task_results[request_id] = {
        "status": "processing",
        "chunks": [],
        "completed": False
    }
    
    try:
        # This would implement proper streaming in a real application
        # For now, we'll just simulate streaming with a delay
        result = await process_completion(request, request.provider or LLMProvider.OPENAI)
        
        # Update with completed result
        task_results[request_id] = {
            "status": "completed",
            "chunks": [result],
            "completed": True,
            "result": result
        }
    except Exception as e:
        # Update with error
        task_results[request_id] = {
            "status": "failed",
            "error": str(e),
            "completed": True
        }

# --- Run with Uvicorn ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8020) 