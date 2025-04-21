import unittest
import asyncio
import websockets
import json
import requests
import aiohttp

class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.base_url = "http://localhost:5001"
        self.ws_url = "ws://localhost:5001"
        self.test_message = "Hello, test message"
        self.test_agent = "researcher"
        
    async def test_websocket_connection(self):
        """Test WebSocket connection"""
        try:
            async with websockets.connect(f"{self.ws_url}/ws/researcher_agent") as websocket:
                # Send a test message
                await websocket.send(json.dumps({
                    "type": "message",
                    "content": "Hello from test"
                }))
                
                # Wait for response with timeout
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                response_data = json.loads(response)
                
                self.assertIn("type", response_data)
                self.assertIn("content", response_data)
        except Exception as e:
            self.fail(f"WebSocket connection failed: {str(e)}")

    def test_agent_chat(self):
        """Test agent chat endpoint"""
        data = {
            "message": "Test message",
            "agent_id": "researcher_agent"
        }
        response = requests.post(f"{self.base_url}/chat", json=data)
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("response", response_data)

    def test_agent_reset(self):
        """Test agent reset endpoint"""
        data = {
            "agent_id": "researcher_agent"
        }
        response = requests.post(f"{self.base_url}/reset", json=data)
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("status", response_data)

    def test_code_analysis_tool(self):
        """Test code analysis tool endpoint"""
        data = {
            "code": "def test(): pass",
            "language": "python"
        }
        response = requests.post(f"{self.base_url}/tools/code_analysis", json=data)
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("analysis", response_data)

    def test_research_tool(self):
        """Test research tool endpoint"""
        data = {
            "query": "test query",
            "max_results": 5
        }
        response = requests.post(f"{self.base_url}/tools/research", json=data)
        self.assertEqual(response.status_code, 200)
        response_data = response.json()
        self.assertIn("results", response_data)

def run_async_test(coro):
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)

if __name__ == '__main__':
    unittest.main() 