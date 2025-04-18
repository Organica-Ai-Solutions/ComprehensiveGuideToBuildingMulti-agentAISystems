from typing import Dict, Any, Callable, Optional, List
import asyncio
import logging
import inspect
from functools import wraps
import time

logger = logging.getLogger(__name__)

class ToolRegistry:
    """Registry for managing and executing tools."""
    
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._default_timeout = 30  # Default timeout in seconds

    def register(self, name: str, func: Callable, description: str = "", 
                examples: List[str] = None, timeout: int = None) -> None:
        """Register a tool with the registry."""
        if name in self._tools:
            raise ValueError(f"Tool {name} is already registered")
            
        # Get function signature for parameter validation
        sig = inspect.signature(func)
        params = {
            name: {
                "type": param.annotation,
                "default": param.default if param.default != inspect.Parameter.empty else None,
                "required": param.default == inspect.Parameter.empty
            }
            for name, param in sig.parameters.items()
        }
        
        self._tools[name] = {
            "func": func,
            "description": description,
            "examples": examples or [],
            "params": params,
            "timeout": timeout or self._default_timeout
        }
        
        logger.info(f"Registered tool: {name}")

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        """Get tool details by name."""
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        """List all registered tools."""
        return [
            {
                "name": name,
                "description": details["description"],
                "examples": details["examples"],
                "params": details["params"]
            }
            for name, details in self._tools.items()
        ]

    async def execute(self, name: str, **kwargs) -> Dict[str, Any]:
        """Execute a tool by name with given arguments."""
        start_time = time.time()
        
        if name not in self._tools:
            raise ValueError(f"Tool {name} not found")
            
        tool = self._tools[name]
        
        # Validate parameters
        for param_name, param_info in tool["params"].items():
            if param_info["required"] and param_name not in kwargs:
                raise ValueError(f"Required parameter {param_name} not provided for tool {name}")
        
        try:
            # Create task with timeout
            func = tool["func"]
            if inspect.iscoroutinefunction(func):
                task = asyncio.create_task(func(**kwargs))
                result = await asyncio.wait_for(task, timeout=tool["timeout"])
            else:
                # Run synchronous functions in executor
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, 
                    lambda: func(**kwargs)
                )
            
            execution_time = time.time() - start_time
            
            return {
                "success": True,
                "result": result,
                "execution_time": execution_time
            }
            
        except asyncio.TimeoutError:
            logger.error(f"Tool {name} timed out after {tool['timeout']} seconds")
            return {
                "success": False,
                "error": "timeout",
                "execution_time": time.time() - start_time
            }
        except Exception as e:
            logger.error(f"Error executing tool {name}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "execution_time": time.time() - start_time
            }

    def validate_tool_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a tool request before execution."""
        required_fields = ["name"]
        for field in required_fields:
            if field not in request:
                return {
                    "valid": False,
                    "error": f"Missing required field: {field}"
                }
        
        tool_name = request["name"]
        if tool_name not in self._tools:
            return {
                "valid": False,
                "error": f"Tool not found: {tool_name}"
            }
        
        tool = self._tools[tool_name]
        args = request.get("args", {})
        
        # Validate required parameters
        for param_name, param_info in tool["params"].items():
            if param_info["required"] and param_name not in args:
                return {
                    "valid": False,
                    "error": f"Missing required parameter: {param_name}"
                }
        
        return {
            "valid": True
        }

def tool(name: str, description: str = "", examples: List[str] = None, 
         timeout: int = None):
    """Decorator for registering tools."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        
        # Store metadata for registration
        wrapper._tool_metadata = {
            "name": name,
            "description": description,
            "examples": examples or [],
            "timeout": timeout
        }
        return wrapper
    return decorator 