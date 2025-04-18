import unittest
import requests
import websockets
import asyncio
import json
from datetime import datetime

class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.base_url = "http://localhost:8000"
        self.ws_url = "ws://localhost:8000"
        
    def test_health_check(self):
        """Test the health check endpoint"""
        response = requests.get(f"{self.base_url}/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("version", data)
        
    def test_get_agents(self):
        """Test getting all agents"""
        response = requests.get(f"{self.base_url}/api/agents")
        self.assertEqual(response.status_code, 200)
        agents = response.json()
        self.assertIsInstance(agents, list)
        if agents:
            self.assertIn("id", agents[0])
            self.assertIn("name", agents[0])
            self.assertIn("role", agents[0])
            
    def test_get_tools(self):
        """Test getting all tools"""
        response = requests.get(f"{self.base_url}/api/tools")
        self.assertEqual(response.status_code, 200)
        tools = response.json()
        self.assertIsInstance(tools, list)
        if tools:
            self.assertIn("id", tools[0])
            self.assertIn("name", tools[0])
            self.assertIn("api_endpoint", tools[0])
            
    def test_get_metrics(self):
        """Test getting system metrics"""
        response = requests.get(f"{self.base_url}/api/metrics")
        self.assertEqual(response.status_code, 200)
        metrics = response.json()
        self.assertIn("active_agents", metrics)
        self.assertIn("total_messages", metrics)
        self.assertIn("mcp", metrics)
        
    def test_route_message(self):
        """Test message routing"""
        payload = {
            "message": "Write a function to calculate fibonacci"
        }
        response = requests.post(f"{self.base_url}/api/agents/route", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("agentId", data)
        self.assertIn("confidence", data)
        
    def test_web_search_tool(self):
        """Test web search tool"""
        payload = {
            "query": "What is artificial intelligence?"
        }
        response = requests.post(f"{self.base_url}/api/tools/web_search", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("results", data)
        
    def test_code_analysis_tool(self):
        """Test code analysis tool"""
        payload = {
            "code": "def hello(): print('world')",
            "language": "python"
        }
        response = requests.post(f"{self.base_url}/api/tools/code_analysis", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        
    def test_text_processing_tool(self):
        """Test text processing tool"""
        payload = {
            "text": "This is a test sentence.",
            "operation": "summarize"
        }
        response = requests.post(f"{self.base_url}/api/tools/text_processing", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        
    async def test_websocket_connection(self):
        """Test WebSocket connection"""
        async with websockets.connect(f"{self.ws_url}/ws/researcher_agent") as websocket:
            # Send a test message
            message = {
                "type": "message",
                "content": "Hello, agent!",
                "timestamp": datetime.now().isoformat()
            }
            await websocket.send(json.dumps(message))
            
            # Wait for response
            response = await websocket.recv()
            response_data = json.loads(response)
            self.assertIn("type", response_data)
            self.assertIn("content", response_data)
            
    def test_security_events(self):
        """Test security events endpoint"""
        response = requests.get(f"{self.base_url}/api/security/events")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("events", data)
        self.assertIn("last_checked", data)
        
    def test_agent_chat(self):
        """Test agent chat endpoint"""
        agent_id = "researcher_agent"
        payload = {
            "content": "Tell me about quantum computing",
            "sender": "user"
        }
        response = requests.post(f"{self.base_url}/api/agents/{agent_id}/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("content", data)
        self.assertIn("reasoning_steps", data)
        
    def test_agent_reset(self):
        """Test agent reset endpoint"""
        agent_id = "researcher_agent"
        response = requests.post(f"{self.base_url}/api/agents/{agent_id}/reset")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

def run_async_tests():
    """Run async tests using asyncio"""
    loop = asyncio.get_event_loop()
    loop.run_until_complete(TestAPIEndpoints().test_websocket_connection())

if __name__ == "__main__":
    # Run synchronous tests
    unittest.main(verbosity=2, exit=False)
    
    # Run async tests
    print("\nRunning async tests:")
    run_async_tests()
    print("Async tests completed") 