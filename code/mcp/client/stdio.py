"""
Standard I/O based client implementation.
"""
import json
import sys
from typing import Any, Dict, Optional

def stdio_client(server_params: Dict[str, Any]):
    """
    Create a client that communicates with an MCP server via standard I/O.
    
    Args:
        server_params: Dictionary containing server parameters
    """
    while True:
        try:
            # Read a line from stdin
            line = sys.stdin.readline()
            if not line:
                break
                
            # Parse the request
            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                response = {"error": "Invalid JSON request"}
                json.dump(response, sys.stdout)
                sys.stdout.write('\n')
                sys.stdout.flush()
                continue
                
            # Process the request
            try:
                method = request.get('method')
                params = request.get('params', {})
                
                if method == 'ping':
                    response = {"result": "pong"}
                else:
                    response = {"error": f"Unknown method: {method}"}
                    
                json.dump(response, sys.stdout)
                sys.stdout.write('\n')
                sys.stdout.flush()
                
            except Exception as e:
                response = {"error": str(e)}
                json.dump(response, sys.stdout)
                sys.stdout.write('\n')
                sys.stdout.flush()
                
        except Exception as e:
            response = {"error": f"Client error: {str(e)}"}
            json.dump(response, sys.stdout)
            sys.stdout.write('\n')
            sys.stdout.flush() 