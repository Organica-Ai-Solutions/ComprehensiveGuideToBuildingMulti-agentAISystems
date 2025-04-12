import asyncio
import sys
import os

# Adjust path to find the mcp library if needed (assuming standard install)
# If running from workspace root, imports should work if mcp is installed

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import TextContent # Import specific types if needed

# --- MCP Server Connection Parameters ---
# Assumes the server script is in the sibling directory 'mcp_server'
# Get the absolute path to the directory containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Construct the absolute path to the server script
server_script_path = os.path.join(script_dir, "..", "mcp_server", "server.py")

# Check if the server script exists
if not os.path.exists(server_script_path):
    print(f"Error: MCP Server script not found at {server_script_path}")
    print("Please ensure code/mcp_server/server.py exists.")
    sys.exit(1)

server_params = StdioServerParameters(
    command=sys.executable,  # Use the same Python interpreter that runs the client
    args=[server_script_path], # Absolute path to the server script
    env=None, # Inherit environment from client
)

async def main():
    print(f"Attempting to start MCP server: {server_params.command} { ' '.join(server_params.args)}")
    try:
        async with stdio_client(server_params) as (read_stream, write_stream):
            print("MCP Client: Connected to server.")
            async with ClientSession(read_stream, write_stream) as session:
                print("MCP Client: Session created.")

                # 1. Initialize the connection (sends capabilities)
                init_response = await session.initialize()
                print(f"MCP Client: Initialization successful. Server: {init_response.server_name} v{init_response.server_version}")
                print("Server Capabilities:", init_response.capabilities)

                # 2. List available tools
                print("\n--- Listing Tools ---")
                tools = await session.list_tools()
                print(f"Available tools: {[tool.name for tool in tools]}")
                for tool in tools:
                    print(f"  - {tool.name}: {tool.description}")

                # 3. Call a tool (Example: calculator)
                print("\n--- Calling Tool: calculator ---")
                try:
                    calc_result = await session.call_tool("calculator", arguments={"expression": "(5 + 3) * 2"})
                    print(f"Calculator result: {calc_result}")
                except Exception as e:
                    print(f"Error calling calculator tool: {e}")
                
                # 4. Call another tool (Example: web_search)
                print("\n--- Calling Tool: web_search ---")
                try:
                    search_result = await session.call_tool("web_search", arguments={"query": "multi-agent systems"})
                    print(f"Web search result: {search_result}")
                except Exception as e:
                    print(f"Error calling web_search tool: {e}")

                # 5. Call Weather Alerts Tool
                print("\n--- Calling Tool: get_weather_alerts ---")
                try:
                    # Example: California
                    alerts_result = await session.call_tool("get_weather_alerts", arguments={"state": "CA"})
                    print(f"Weather alerts result (CA):\n{alerts_result}") 
                    # Example: Invalid State
                    alerts_result_invalid = await session.call_tool("get_weather_alerts", arguments={"state": "XYZ"})
                    print(f"Weather alerts result (XYZ):\n{alerts_result_invalid}")
                except Exception as e:
                    print(f"Error calling get_weather_alerts tool: {e}")
                
                # 6. Call Weather Forecast Tool
                print("\n--- Calling Tool: get_weather_forecast ---")
                try:
                    # Example: Washington D.C.
                    forecast_result = await session.call_tool(
                        "get_weather_forecast", 
                        arguments={"latitude": 38.8951, "longitude": -77.0364}
                    )
                    print(f"Weather forecast result (DC):\n{forecast_result}")
                except Exception as e:
                    print(f"Error calling get_weather_forecast tool: {e}")

                # 7. List available resources
                print("\n--- Listing Resources ---")
                resources = await session.list_resources()
                print(f"Available resources: {[res.uri for res in resources]}")
                for res in resources:
                     print(f"  - {res.uri}: {res.description}")

                # 8. Read a resource (Example: context://summary)
                print("\n--- Reading Resource: context://summary ---")
                try:
                    content, mime_type = await session.read_resource("context://summary")
                    print(f"Resource content (mime: {mime_type}):\n{content.decode()}") # Assuming text content
                except Exception as e:
                    print(f"Error reading resource: {e}")

                # 9. List available prompts
                print("\n--- Listing Prompts ---")
                prompts = await session.list_prompts()
                print(f"Available prompts: {[p.name for p in prompts]}")
                for p in prompts:
                     print(f"  - {p.name}: {p.description}")

                # 10. Get a prompt (Example: ask_tool_recommendation)
                print("\n--- Getting Prompt: ask_tool_recommendation ---")
                try:
                    # Note: get_prompt returns the messages *to be sent* to an LLM.
                    # This client doesn't have an LLM, so we just print the structure.
                    prompt_data = await session.get_prompt("ask_tool_recommendation", arguments={"task": "Find the capital of France"})
                    print(f"Prompt structure for LLM: {prompt_data}")
                    # Example of accessing the actual text content
                    if prompt_data.messages and isinstance(prompt_data.messages[0].content, TextContent):
                         print(f"Prompt text: {prompt_data.messages[0].content.text}")

                except Exception as e:
                    print(f"Error getting prompt: {e}")

                print("\nMCP Client: Tests complete. Closing session.")

    except Exception as e:
        print(f"MCP Client: Failed to connect or interact with server: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Ensure the event loop is managed correctly, especially on Windows
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    asyncio.run(main()) 