from typing import Dict, Any, List, Optional
import asyncio
import logging
from datetime import datetime
from uuid import uuid4

from tools.handlers import ToolRegistry
from safety.guardrails import SafetyGuardrails

logger = logging.getLogger(__name__)

class Agent:
    """Base agent class with core functionality."""
    
    def __init__(
        self,
        agent_id: str,
        name: str,
        role: str,
        goal: str,
        tool_registry: ToolRegistry,
        guardrails: SafetyGuardrails,
        capabilities: List[str] = None,
        memory_size: int = 1000
    ):
        self.id = agent_id or str(uuid4())
        self.name = name
        self.role = role
        self.goal = goal
        self.capabilities = capabilities or []
        self.status = "initialized"
        
        self._tool_registry = tool_registry
        self._guardrails = guardrails
        self._memory: List[Dict[str, Any]] = []
        self._memory_size = memory_size
        self._current_task: Optional[Dict[str, Any]] = None
        self._last_active = datetime.now()

    async def process_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Process an incoming message and generate a response."""
        try:
            self._last_active = datetime.now()
            self.status = "processing"
            
            # Validate message safety
            safety_check = self._guardrails.check_content_safety(message.get("content", ""))
            if not safety_check["safe"]:
                return {
                    "success": False,
                    "error": "Safety check failed",
                    "issues": safety_check["issues"]
                }
            
            # Add to memory
            self._add_to_memory({
                "type": "received",
                "content": message,
                "timestamp": datetime.now().isoformat()
            })
            
            # Generate response based on role and goal
            response = await self._generate_response(message)
            
            # Add response to memory
            self._add_to_memory({
                "type": "sent",
                "content": response,
                "timestamp": datetime.now().isoformat()
            })
            
            self.status = "idle"
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            self.status = "error"
            return {
                "success": False,
                "error": str(e)
            }

    async def _generate_response(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a response based on the message, role, and goal."""
        # This should be implemented by specific agent types
        raise NotImplementedError
    
    async def use_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Use a registered tool."""
        if tool_name not in self.capabilities:
            return {
                "success": False,
                "error": f"Agent does not have capability: {tool_name}"
            }
        
        # Validate tool request
        tool_request = {
            "name": tool_name,
            "args": kwargs,
            "requester": self.id
        }
        
        safety_check = self._guardrails.check_tool_safety(tool_request)
        if not safety_check["safe"]:
            return {
                "success": False,
                "error": "Tool usage failed safety check",
                "issues": safety_check["issues"]
            }
        
        # Execute tool
        return await self._tool_registry.execute(tool_name, **kwargs)
    
    def _add_to_memory(self, entry: Dict[str, Any]) -> None:
        """Add an entry to agent's memory, maintaining size limit."""
        self._memory.append(entry)
        if len(self._memory) > self._memory_size:
            self._memory.pop(0)
    
    def get_memory(self, limit: int = None) -> List[Dict[str, Any]]:
        """Get recent memory entries."""
        if limit:
            return self._memory[-limit:]
        return self._memory
    
    def get_status(self) -> Dict[str, Any]:
        """Get agent's current status."""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "goal": self.goal,
            "status": self.status,
            "capabilities": self.capabilities,
            "last_active": self._last_active.isoformat(),
            "memory_size": len(self._memory),
            "current_task": self._current_task
        }
    
    async def start(self) -> None:
        """Start the agent."""
        self.status = "idle"
        logger.info(f"Agent {self.name} ({self.id}) started")
    
    async def stop(self) -> None:
        """Stop the agent."""
        self.status = "stopped"
        logger.info(f"Agent {self.name} ({self.id}) stopped") 