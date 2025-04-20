"""
MCP Client application.
"""
from mcp.client.stdio import stdio_client

def main():
    """Main entry point for the MCP client."""
    server_params = {
        "server_name": "BookProjectMCP",
        "protocol": "stdio"
    }
    stdio_client(server_params)

if __name__ == "__main__":
    main() 