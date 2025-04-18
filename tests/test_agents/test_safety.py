import pytest
from safety.guardrails import SafetyGuardrails
from typing import Dict, Any

@pytest.fixture
def guardrails():
    return SafetyGuardrails()

def test_code_safety_check():
    """Test code safety validation"""
    guardrails = SafetyGuardrails()
    
    # Test dangerous system command
    dangerous_code = """
    import os
    os.system('rm -rf /')
    """
    result = guardrails.check_code_safety(dangerous_code)
    assert result["safe"] is False
    assert any(issue["type"] == "dangerous_command" for issue in result["issues"])
    
    # Test safe code
    safe_code = """
    def add(a, b):
        return a + b
    """
    result = guardrails.check_code_safety(safe_code)
    assert result["safe"] is True
    assert len(result["issues"]) == 0

def test_tool_safety_check():
    """Test tool usage safety validation"""
    guardrails = SafetyGuardrails()
    
    # Test dangerous tool request
    dangerous_tool = {
        "name": "system_command",
        "args": ["rm -rf /"],
        "requester": "test_agent"
    }
    result = guardrails.check_tool_safety(dangerous_tool)
    assert result["safe"] is False
    assert "insufficient_permissions" in result["reason"]
    
    # Test safe tool request
    safe_tool = {
        "name": "calculator",
        "args": [1, 2, "+"],
        "requester": "test_agent"
    }
    result = guardrails.check_tool_safety(safe_tool)
    assert result["safe"] is True

def test_resource_limits():
    """Test resource usage limits"""
    guardrails = SafetyGuardrails()
    
    # Test excessive memory usage
    memory_heavy_code = """
    large_array = [0] * (10**9)  # Attempt to create a very large array
    """
    result = guardrails.check_resource_limits(memory_heavy_code)
    assert result["safe"] is False
    assert any(issue["type"] == "memory_limit" for issue in result["issues"])
    
    # Test CPU-intensive code
    cpu_heavy_code = """
    while True:
        pass
    """
    result = guardrails.check_resource_limits(cpu_heavy_code)
    assert result["safe"] is False
    assert any(issue["type"] == "infinite_loop" for issue in result["issues"])

def test_content_safety():
    """Test content safety validation"""
    guardrails = SafetyGuardrails()
    
    # Test harmful content
    harmful_content = "Here's how to create a computer virus..."
    result = guardrails.check_content_safety(harmful_content)
    assert result["safe"] is False
    assert any(issue["type"] == "harmful_content" for issue in result["issues"])
    
    # Test safe content
    safe_content = "The weather is nice today."
    result = guardrails.check_content_safety(safe_content)
    assert result["safe"] is True
    assert len(result["issues"]) == 0

def test_pii_detection():
    """Test PII (Personally Identifiable Information) detection"""
    guardrails = SafetyGuardrails()
    
    # Test content with PII
    pii_content = "My SSN is 123-45-6789 and my email is test@example.com"
    result = guardrails.check_content_safety(pii_content)
    assert result["safe"] is False
    assert any(issue["type"] == "pii_detected" for issue in result["issues"])
    
    # Test content without PII
    safe_content = "The project deadline is next week."
    result = guardrails.check_content_safety(safe_content)
    assert result["safe"] is True
    assert not any(issue["type"] == "pii_detected" for issue in result["issues"])

def test_combined_safety_checks():
    """Test multiple safety checks together"""
    guardrails = SafetyGuardrails()
    
    # Test code with multiple issues
    problematic_code = """
    import os
    # Delete system files
    os.system('rm -rf /')
    
    # Create infinite loop
    while True:
        # Leak PII
        print('SSN: 123-45-6789')
    """
    
    result = guardrails.check_all_safety(problematic_code)
    assert result["safe"] is False
    assert len(result["issues"]) >= 3  # Should detect multiple issues
    
    # Verify specific issues are detected
    issue_types = [issue["type"] for issue in result["issues"]]
    assert "dangerous_command" in issue_types
    assert "infinite_loop" in issue_types
    assert "pii_detected" in issue_types 