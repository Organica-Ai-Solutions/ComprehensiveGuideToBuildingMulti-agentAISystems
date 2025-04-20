"""
FastMCP server implementation.
"""
from typing import Any, Callable, Dict, List, Optional
from ..types import Resource, Prompt

class FastMCP:
    def __init__(self, name: str):
        self.name = name
        self.tools = {}
        self.resources = {}
        self.prompts = {}
        self.tool_registries = []
    
    def tool(self):
        """Decorator to register a tool."""
        def decorator(func):
            self.tools[func.__name__] = func
            return func
        return decorator
    
    def resource(self, uri: str):
        """Decorator to register a resource."""
        def decorator(func):
            self.resources[uri] = func
            return func
        return decorator
    
    def prompt(self):
        """Decorator to register a prompt."""
        def decorator(func):
            self.prompts[func.__name__] = func
            return func
        return decorator
    
    def list_resources(self):
        """Decorator to register a resource lister."""
        def decorator(func):
            self._list_resources = func
            return func
        return decorator
    
    def list_prompts(self):
        """Decorator to register a prompt lister."""
        def decorator(func):
            self._list_prompts = func
            return func
        return decorator
    
    def register_tool_registry(self, registry: Any):
        """Register a tool registry."""
        self.tool_registries.append(registry)
    
    def run(self, transport: str = 'stdio'):
        """Run the server with the specified transport."""
        if transport == 'stdio':
            self._run_stdio()
        else:
            raise ValueError(f"Unsupported transport: {transport}")
    
    def _run_stdio(self):
        """Run the server using stdio transport."""
        import sys
        import json
        
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                    
                request = json.loads(line)
                response = self._handle_request(request)
                json.dump(response, sys.stdout)
                sys.stdout.write('\n')
                sys.stdout.flush()
                
            except Exception as e:
                error_response = {"error": str(e)}
                json.dump(error_response, sys.stdout)
                sys.stdout.write('\n')
                sys.stdout.flush()
    
    def _handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming request."""
        method = request.get('method')
        params = request.get('params', {})
        
        if method == 'get_tool':
            return {"result": self.tools.get(params['name'])}
        elif method == 'get_resource':
            return {"result": self.resources.get(params['uri'])}
        elif method == 'get_prompt':
            return {"result": self.prompts.get(params['name'])}
        elif method == 'list_resources':
            return {"result": self._list_resources()}
        elif method == 'list_prompts':
            return {"result": self._list_prompts()}
        else:
            return {"error": f"Unknown method: {method}"} 