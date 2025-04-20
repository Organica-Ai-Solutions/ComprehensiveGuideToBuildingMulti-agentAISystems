"""
MCP Client implementation.
"""
from dataclasses import dataclass
from typing import Any, Dict, Optional
import subprocess
import json
import sys

@dataclass
class StdioServerParameters:
    """Parameters for connecting to an MCP server via stdio."""
    command: str
    cwd: Optional[str] = None
    env: Optional[Dict[str, str]] = None

class ClientSession:
    """A client session for interacting with an MCP server."""
    
    def __init__(self, server_params: StdioServerParameters):
        self.server_params = server_params
        self.process = None
        
    def __enter__(self):
        """Start the server process when entering the context."""
        self.process = subprocess.Popen(
            self.server_params.command,
            cwd=self.server_params.cwd,
            env=self.server_params.env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Stop the server process when exiting the context."""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
            
    def _send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a request to the server and get the response."""
        if not self.process:
            raise RuntimeError("Server process not started")
            
        request = {
            "method": method,
            "params": params or {}
        }
        
        request_str = json.dumps(request) + '\n'
        self.process.stdin.write(request_str)
        self.process.stdin.flush()
        
        response_str = self.process.stdout.readline()
        if not response_str:
            raise RuntimeError("Server process terminated unexpectedly")
            
        return json.loads(response_str)
        
    def get_tool(self, name: str) -> Any:
        """Get a tool by name."""
        response = self._send_request("get_tool", {"name": name})
        return response.get("result")
        
    def get_resource(self, uri: str) -> Any:
        """Get a resource by URI."""
        response = self._send_request("get_resource", {"uri": uri})
        return response.get("result")
        
    def get_prompt(self, name: str) -> Any:
        """Get a prompt by name."""
        response = self._send_request("get_prompt", {"name": name})
        return response.get("result")
        
    def list_resources(self) -> Any:
        """List available resources."""
        response = self._send_request("list_resources")
        return response.get("result")
        
    def list_prompts(self) -> Any:
        """List available prompts."""
        response = self._send_request("list_prompts")
        return response.get("result") 