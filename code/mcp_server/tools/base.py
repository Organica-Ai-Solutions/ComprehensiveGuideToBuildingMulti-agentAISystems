from typing import Dict, Any, Callable, Optional
from dataclasses import dataclass

@dataclass
class ToolOutput:
    """Output from a tool execution."""
    content: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class Tool:
    """Represents a tool that can be used by the agent."""
    
    def __init__(
        self,
        name: str,
        description: str,
        function: Callable,
        parameters: Dict[str, Dict[str, Any]]
    ):
        self.name = name
        self.description = description
        self.function = function
        self.parameters = parameters

class ToolRegistry:
    """Registry for managing a collection of tools."""
    
    def __init__(self, namespace: str):
        self.namespace = namespace
        self.tools: Dict[str, Tool] = {}
    
    def register_tool(self, tool: Tool):
        """Register a new tool."""
        self.tools[tool.name] = tool
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self.tools.get(name)
    
    def list_tools(self) -> Dict[str, Dict[str, Any]]:
        """List all registered tools."""
        return {
            name: {
                "description": tool.description,
                "parameters": tool.parameters
            }
            for name, tool in self.tools.items()
        } 