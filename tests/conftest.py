import pytest
from fastapi.testclient import TestClient
from main import app
from tools.handlers import ToolRegistry
from safety.guardrails import SafetyGuardrails

@pytest.fixture
def client():
    """Create a test client for the FastAPI application"""
    return TestClient(app)

@pytest.fixture
def test_agent():
    """Create a test agent fixture"""
    return {
        "id": "test-agent",
        "name": "Test Agent",
        "role": "test",
        "goal": "testing",
        "capabilities": ["test"],
        "status": "active"
    }

@pytest.fixture
def tool_registry():
    """Create a tool registry with some test tools"""
    registry = ToolRegistry()
    
    @registry.tool("test_tool")
    async def test_tool(arg1: str, arg2: int):
        return {"result": f"{arg1} {arg2}"}
    
    return registry

@pytest.fixture
def guardrails():
    """Create a safety guardrails instance"""
    return SafetyGuardrails()

@pytest.fixture(autouse=True)
def cleanup():
    """Clean up after each test"""
    yield
    # Clear test data
    if hasattr(app.state, 'agents'):
        app.state.agents.clear()
    if hasattr(app.state, 'messages'):
        app.state.messages.clear()
    if hasattr(app.state, 'tools'):
        app.state.tools.clear()

@pytest.fixture
def mock_llm_response():
    """Mock response from language model"""
    return {
        "content": "This is a test response",
        "reasoning_steps": [
            {"step_number": 1, "content": "Analyzed input"},
            {"step_number": 2, "content": "Generated response"}
        ],
        "confidence": 0.95
    }

@pytest.fixture
def sample_messages():
    """Sample chat messages for testing"""
    return [
        {
            "id": "msg1",
            "content": "Hello",
            "sender": "user",
            "timestamp": "2024-03-14T12:00:00",
            "agent_id": "test-agent"
        },
        {
            "id": "msg2",
            "content": "Hi there!",
            "sender": "agent",
            "timestamp": "2024-03-14T12:00:01",
            "agent_id": "test-agent"
        }
    ] 