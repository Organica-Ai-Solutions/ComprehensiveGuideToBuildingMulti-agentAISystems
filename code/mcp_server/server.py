from mcp.server.fastmcp import FastMCP
from mcp.types import Resource, Prompt
from typing import List, Dict, Any
import httpx

# Import the tool registry classes
from tools.browser_tools import BrowserTools
from tools.os_tools import OSTools

# Create an MCP server instance
# The name "BookProjectMCP" will be used by clients to identify this server
mcp = FastMCP("BookProjectMCP")

# Initialize tool registries
browser_tools = BrowserTools()
os_tools = OSTools(base_dir="./workspace")  # Limit file operations to a workspace directory

# --- Weather Tool Constants & Helpers ---
NWS_API_BASE = "https://api.weather.gov"
# It's good practice to identify your application to APIs
USER_AGENT = "BuildingMultiAgentAISystemsBook/1.0 (github.com/your_repo)" # TODO: Update with your repo if public

async def make_nws_request(url: str) -> dict[str, Any] | None:
    """Make a request to the NWS API with proper error handling."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
            return response.json()
        except httpx.HTTPStatusError as exc:
            print(f"HTTP error occurred: {exc.response.status_code} - {exc.response.text}")
            return None
        except httpx.RequestError as exc:
            print(f"An error occurred while requesting {exc.request.url!r}: {exc}")
            return None
        except Exception as exc:
            print(f"An unexpected error occurred: {exc}")
            return None

def format_alert(feature: dict) -> str:
    """Format an alert feature into a readable string."""
    props = feature.get("properties", {})
    # Ensure required fields exist, provide defaults
    event = props.get('event', 'Unknown Event')
    area = props.get('areaDesc', 'Unknown Area')
    severity = props.get('severity', 'Unknown Severity')
    description = props.get('description', 'No description available').strip()
    instruction = props.get('instruction', 'No specific instructions provided').strip()
    return f"""
Event: {event}
Area: {area}
Severity: {severity}
Description: {description}
Instructions: {instruction}
"""

# --- Tools (using @mcp.tool decorator) ---

@mcp.tool()
async def get_weather_alerts(state: str) -> str:
    """Get active weather alerts for a specific US state.

    Args:
        state: The two-letter US state code (e.g., CA, TX, NY).
    """
    if not state or len(state) != 2 or not state.isalpha():
        return "Invalid state code. Please provide a two-letter US state code."
    
    state_upper = state.upper()
    url = f"{NWS_API_BASE}/alerts/active/area/{state_upper}"
    print(f"Fetching alerts from: {url}")
    data = await make_nws_request(url)

    if data is None:
        return f"Failed to fetch alerts for {state_upper}. Check server logs for details."
    
    features = data.get("features")
    if not features:
        return f"No active weather alerts found for {state_upper}."

    alerts = [format_alert(feature) for feature in features]
    if not alerts:
         return f"Found alert data for {state_upper}, but failed to format any alerts."
         
    return f"Active Alerts for {state_upper}:\n---\n" + "\n---\n".join(alerts)

@mcp.tool()
async def get_weather_forecast(latitude: float, longitude: float) -> str:
    """Get the weather forecast for a specific latitude and longitude in the US.

    Args:
        latitude: The latitude of the location.
        longitude: The longitude of the location.
    """
    print(f"Fetching forecast for coordinates: {latitude}, {longitude}")
    # 1. Get the grid points URL from coordinates
    points_url = f"{NWS_API_BASE}/points/{latitude:.4f},{longitude:.4f}"
    points_data = await make_nws_request(points_url)

    if points_data is None or "properties" not in points_data or "forecast" not in points_data["properties"]:
        print(f"Failed to get forecast grid URL from {points_url}")
        return "Unable to determine forecast grid for this location. Are the coordinates within the US?"

    # 2. Get the forecast URL from the grid points response
    forecast_url = points_data["properties"]["forecast"]
    print(f"Fetching forecast data from: {forecast_url}")
    forecast_data = await make_nws_request(forecast_url)

    if forecast_data is None or "properties" not in forecast_data or "periods" not in forecast_data["properties"]:
        print(f"Failed to get detailed forecast data from {forecast_url}")
        return "Unable to fetch detailed forecast data."

    # 3. Format the forecast periods
    periods = forecast_data["properties"]["periods"]
    if not periods:
        return "No forecast periods found in the data."
    
    forecasts = []
    # Limit to a reasonable number of periods (e.g., next 5)
    for period in periods[:5]:  
        try:
            forecast = f"""
{period.get('name', 'Unknown Period')}:
Temperature: {period.get('temperature', '?')}°{period.get('temperatureUnit', 'F')}
Wind: {period.get('windSpeed', 'N/A')} {period.get('windDirection', '')}
Forecast: {period.get('detailedForecast', 'No details available.')}
"""
            forecasts.append(forecast.strip())
        except Exception as e:
            print(f"Error formatting period: {period}. Error: {e}")
            continue # Skip this period if formatting fails

    if not forecasts:
        return "Found forecast data, but failed to format any periods."
        
    return "Forecast:\n---\n" + "\n---\n".join(forecasts)

# --- Resources ---
# Example resource: Project summary
@mcp.resource("context://summary")
def get_project_summary() -> str:
    """Returns a simple text summary of the project state."""
    # In a real server, this could read from a file, DB, or generate dynamically
    return "Project Status: Chapter 1-6 drafted. Backend/Frontend scaffolded. MCP server includes weather tools."

# Example resource listing (optional, good practice)
@mcp.list_resources()
def list_available_resources() -> List[Resource]:
     """Lists the available resources."""
     return [
         Resource(uri="context://summary", description="Provides a brief summary of the project's current state.")
     ]

# --- Prompts ---
# Example prompt: Recommend a tool
@mcp.prompt()
def ask_tool_recommendation(task: str) -> str:
    """Generates a prompt asking an LLM to recommend a tool for a given task."""
    return f"Given the available tools, which one would be best suited for the following task: '{task}'? Please explain your reasoning."

# Example prompt listing (optional, good practice)
@mcp.list_prompts()
def list_available_prompts() -> List[Prompt]:
    """Lists the available prompt templates."""
    return [
        Prompt(
            name="ask_tool_recommendation",
            description="Asks for a tool recommendation based on a task description.",
            arguments=[{"name": "task", "description": "The task description", "required": True}]
        )
    ]

# --- Running the Server ---
if __name__ == "__main__":
    # Register tool registries with the MCP server
    mcp.register_tool_registry(browser_tools)
    mcp.register_tool_registry(os_tools)
    
    # Run the server using stdio transport by default
    # Clients will connect by running this script as a subprocess
    print("Starting MCP server via stdio...")
    mcp.run(transport='stdio') 