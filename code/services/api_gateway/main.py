from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse
import httpx
import asyncio
import time
import os
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

# --- API Gateway Configuration ---
API_KEY_NAME = "X-API-Key"
API_KEY = os.environ.get("API_GATEWAY_KEY", "development_api_key")  # Use environment variable in production
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

# Service endpoints - These would be environment variables in production
SERVICE_ENDPOINTS = {
    "agent_orchestration": "http://localhost:8001",
    "memory_vector": "http://localhost:8002",
    "memory_kv": "http://localhost:8003",
    "memory_document": "http://localhost:8004",
    "tool_search": "http://localhost:8010",
    "tool_calculation": "http://localhost:8011",
    "tool_data": "http://localhost:8012",
    "llm_proxy": "http://localhost:8020",
}

# --- FastAPI App ---
app = FastAPI(
    title="Multi-Agent System API Gateway",
    description="API Gateway for the Multi-Agent AI System",
    version="0.1.0"
)

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiting ---
class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.window_size = 60  # 1 minute in seconds
        self.clients: Dict[str, List[float]] = {}
        
    async def check_rate_limit(self, client_id: str) -> bool:
        current_time = time.time()
        
        # Initialize client if not exists
        if client_id not in self.clients:
            self.clients[client_id] = []
        
        # Remove timestamps older than the window
        self.clients[client_id] = [ts for ts in self.clients[client_id] 
                                 if current_time - ts < self.window_size]
        
        # Check if client exceeds rate limit
        if len(self.clients[client_id]) >= self.requests_per_minute:
            return False
        
        # Add current request timestamp
        self.clients[client_id].append(current_time)
        return True

rate_limiter = RateLimiter()

# --- Authentication Dependency ---
async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return api_key

# --- Rate Limiting Middleware ---
@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    client_id = request.client.host
    if not await rate_limiter.check_rate_limit(client_id):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded"}
        )
    response = await call_next(request)
    return response

# --- Models ---
class HealthResponse(BaseModel):
    status: str
    services: Dict[str, str]

class ServiceRequest(BaseModel):
    service: str
    endpoint: str
    method: str = "GET"
    data: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None

class ServiceResponse(BaseModel):
    status_code: int
    data: Any
    headers: Dict[str, str] = Field(default_factory=dict)

# --- API Routes ---
@app.get("/", response_model=HealthResponse)
async def health_check():
    """Check the health of the API gateway and registered services"""
    services_status = {}
    async with httpx.AsyncClient() as client:
        for service_name, url in SERVICE_ENDPOINTS.items():
            try:
                # Simple health check - just see if the service responds
                # In production, you'd implement a proper health check endpoint on each service
                resp = await client.get(f"{url}/health", timeout=2.0)
                services_status[service_name] = "up" if resp.status_code == 200 else "degraded"
            except Exception:
                services_status[service_name] = "down"
    
    return {
        "status": "operational",
        "services": services_status
    }

@app.post("/api/v1/proxy", response_model=ServiceResponse, dependencies=[Depends(verify_api_key)])
async def proxy_request(request: ServiceRequest):
    """Proxy requests to the appropriate internal service"""
    if request.service not in SERVICE_ENDPOINTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown service: {request.service}"
        )
    
    service_url = SERVICE_ENDPOINTS[request.service]
    target_url = f"{service_url}{request.endpoint}"
    
    # Set default headers
    headers = request.headers or {}
    if "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"
    
    # Send request to the service
    async with httpx.AsyncClient() as client:
        try:
            if request.method == "GET":
                response = await client.get(target_url, headers=headers, timeout=30.0)
            elif request.method == "POST":
                response = await client.post(target_url, json=request.data, headers=headers, timeout=30.0)
            elif request.method == "PUT":
                response = await client.put(target_url, json=request.data, headers=headers, timeout=30.0)
            elif request.method == "DELETE":
                response = await client.delete(target_url, headers=headers, timeout=30.0)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported method: {request.method}"
                )
                
            return {
                "status_code": response.status_code,
                "data": response.json() if response.headers.get("content-type") == "application/json" else response.text,
                "headers": dict(response.headers)
            }
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Service request failed: {str(exc)}"
            )

# --- Direct Routes ---
# Agent-related endpoints
@app.get("/api/v1/agents", dependencies=[Depends(verify_api_key)])
async def get_agents():
    """Get a list of all agents"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{SERVICE_ENDPOINTS['agent_orchestration']}/agents")
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Agent service unavailable: {str(exc)}"
            )

@app.post("/api/v1/tasks", dependencies=[Depends(verify_api_key)])
async def create_task(request: Request):
    """Create a new agent task"""
    data = await request.json()
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SERVICE_ENDPOINTS['agent_orchestration']}/tasks", 
                json=data
            )
            return response.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Agent service unavailable: {str(exc)}"
            )

# --- Run with Uvicorn ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)