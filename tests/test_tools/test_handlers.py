import pytest
from tools.handlers import ToolRegistry, Tool
from typing import Dict, Any
import asyncio

@pytest.fixture
def tool_registry():
    registry = ToolRegistry()
    
    # Add a test tool
    @registry.tool("test_tool")
    async def test_tool(arg1: str, arg2: int) -> Dict[str, Any]:
        return {"result": f"{arg1} {arg2}"}
    
    return registry

@pytest.mark.asyncio
async def test_tool_registration():
    """Test tool registration and retrieval"""
    registry = ToolRegistry()
    
    # Register a test tool
    @registry.tool("calculator")
    async def calculator(a: int, b: int, operation: str) -> Dict[str, Any]:
        if operation == "+":
            return {"result": a + b}
        elif operation == "*":
            return {"result": a * b}
        else:
            raise ValueError(f"Unsupported operation: {operation}")
    
    # Verify tool was registered
    assert "calculator" in registry.tools
    assert registry.tools["calculator"].name == "calculator"

@pytest.mark.asyncio
async def test_tool_execution():
    """Test tool execution with various inputs"""
    registry = ToolRegistry()
    
    @registry.tool("echo")
    async def echo(message: str) -> Dict[str, Any]:
        return {"message": message}
    
    # Test successful execution
    result = await registry.execute_tool("echo", {"message": "Hello"})
    assert result["message"] == "Hello"
    
    # Test execution with missing tool
    with pytest.raises(ValueError):
        await registry.execute_tool("non_existent", {})
    
    # Test execution with invalid parameters
    with pytest.raises(ValueError):
        await registry.execute_tool("echo", {"invalid_param": "value"})

@pytest.mark.asyncio
async def test_tool_timeout():
    """Test tool execution timeout"""
    registry = ToolRegistry()
    
    @registry.tool("slow_tool")
    async def slow_tool() -> Dict[str, Any]:
        await asyncio.sleep(2)  # Simulate slow operation
        return {"result": "done"}
    
    # Test timeout
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(
            registry.execute_tool("slow_tool", {}),
            timeout=1.0
        )

@pytest.mark.asyncio
async def test_concurrent_tool_execution():
    """Test running multiple tools concurrently"""
    registry = ToolRegistry()
    
    @registry.tool("delayed_echo")
    async def delayed_echo(message: str, delay: float) -> Dict[str, Any]:
        await asyncio.sleep(delay)
        return {"message": message}
    
    # Run multiple tools concurrently
    tasks = [
        registry.execute_tool("delayed_echo", {"message": "First", "delay": 0.1}),
        registry.execute_tool("delayed_echo", {"message": "Second", "delay": 0.2}),
        registry.execute_tool("delayed_echo", {"message": "Third", "delay": 0.3})
    ]
    
    results = await asyncio.gather(*tasks)
    
    assert results[0]["message"] == "First"
    assert results[1]["message"] == "Second"
    assert results[2]["message"] == "Third"

@pytest.mark.asyncio
async def test_tool_error_handling():
    """Test error handling in tools"""
    registry = ToolRegistry()
    
    @registry.tool("error_tool")
    async def error_tool(should_fail: bool) -> Dict[str, Any]:
        if should_fail:
            raise ValueError("Tool execution failed")
        return {"status": "success"}
    
    # Test successful execution
    result = await registry.execute_tool("error_tool", {"should_fail": False})
    assert result["status"] == "success"
    
    # Test error handling
    with pytest.raises(ValueError):
        await registry.execute_tool("error_tool", {"should_fail": True})

@pytest.mark.asyncio
async def test_tool_validation():
    """Test tool input validation"""
    registry = ToolRegistry()
    
    # Register a tool with type hints
    @registry.tool("typed_tool")
    async def typed_tool(number: int, text: str) -> Dict[str, Any]:
        return {"result": f"{text} {number}"}
    
    # Test with correct types
    result = await registry.execute_tool("typed_tool", {
        "number": 42,
        "text": "Answer:"
    })
    assert result["result"] == "Answer: 42"
    
    # Test with incorrect types
    with pytest.raises(ValueError):
        await registry.execute_tool("typed_tool", {
            "number": "not a number",
            "text": 123
        })

@pytest.mark.asyncio
async def test_tool_documentation():
    """Test tool documentation and metadata"""
    registry = ToolRegistry()
    
    @registry.tool(
        name="documented_tool",
        description="A well documented tool",
        examples=[
            {"input": {"x": 1}, "output": {"result": 1}},
            {"input": {"x": 2}, "output": {"result": 4}}
        ]
    )
    async def documented_tool(x: int) -> Dict[str, Any]:
        """Calculate the square of a number."""
        return {"result": x * x}
    
    tool = registry.tools["documented_tool"]
    assert tool.description == "A well documented tool"
    assert len(tool.examples) == 2
    assert tool.examples[0]["input"]["x"] == 1 