import pytest
from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_list_agents():
    """Test GET /api/agents endpoint"""
    response = client.get("/api/agents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_agent():
    """Test GET /api/agents/{agent_id} endpoint"""
    # First create a test agent
    test_agent = {
        "id": "test-agent",
        "name": "Test Agent",
        "role": "test",
        "goal": "testing",
        "capabilities": ["test"],
        "status": "active"
    }
    app.state.agents["test-agent"] = test_agent
    
    response = client.get("/api/agents/test-agent")
    assert response.status_code == 200
    assert response.json()["id"] == "test-agent"
    
    # Test non-existent agent
    response = client.get("/api/agents/non-existent")
    assert response.status_code == 404

def test_chat_with_agent():
    """Test POST /api/agents/{agent_id}/chat endpoint"""
    # Ensure test agent exists
    test_agent = {
        "id": "test-agent",
        "name": "Test Agent",
        "role": "test",
        "goal": "testing",
        "capabilities": ["test"],
        "status": "active"
    }
    app.state.agents["test-agent"] = test_agent
    
    # Test valid chat request
    chat_request = {
        "content": "Hello, test agent!"
    }
    response = client.post(
        "/api/agents/test-agent/chat",
        json=chat_request
    )
    assert response.status_code == 200
    assert "content" in response.json()
    assert "reasoning_steps" in response.json()
    
    # Test invalid chat request (missing content)
    response = client.post(
        "/api/agents/test-agent/chat",
        json={}
    )
    assert response.status_code == 400
    
    # Test chat with non-existent agent
    response = client.post(
        "/api/agents/non-existent/chat",
        json=chat_request
    )
    assert response.status_code == 404

def test_get_metrics():
    """Test GET /api/metrics endpoint"""
    response = client.get("/api/metrics")
    assert response.status_code == 200
    metrics = response.json()
    assert "active_agents" in metrics
    assert "total_messages" in metrics
    assert "recent_messages" in metrics
    assert "system_load" in metrics
    assert "memory_usage" in metrics

@pytest.fixture(autouse=True)
def cleanup():
    """Cleanup after each test"""
    yield
    # Clear test data
    if hasattr(app.state, 'agents'):
        app.state.agents.clear()
    if hasattr(app.state, 'messages'):
        app.state.messages.clear() 