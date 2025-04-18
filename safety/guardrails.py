import re
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class SafetyGuardrails:
    """Safety guardrails for code and content validation."""
    
    def __init__(self):
        self.dangerous_patterns = [
            r"rm\s+-rf\s+/",  # System deletion
            r"sudo\s+",  # Sudo commands
            r"exec\s*\(",  # Code execution
            r"eval\s*\(",  # Code evaluation
            r"(?<!\.)\bos\s*\.\s*system\s*\(",  # OS system calls
            r"subprocess\s*\.\s*(?:call|run|Popen)",  # Subprocess calls
        ]
        
        self.pii_patterns = [
            r"\b\d{3}[-.]?\d{2}[-.]?\d{4}\b",  # SSN
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
            r"\b(?:\d[ -]*?){13,16}\b",  # Credit card
        ]
        
        self.resource_patterns = [
            r"while\s*True\s*:",  # Infinite loops
            r"for\s*.*\s*in\s*range\s*\(\s*[0-9]{8,}\s*\)",  # Large loops
            r"\[\s*0\s*\]\s*\*\s*(?:[0-9]{8,}|10\s*\*\*\s*[0-9]{1,})",  # Large arrays
        ]

    def check_code_safety(self, code: str) -> Dict[str, Any]:
        """Check code for dangerous patterns."""
        issues = []
        
        # Check for dangerous patterns
        for pattern in self.dangerous_patterns:
            matches = re.finditer(pattern, code, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": "dangerous_command",
                    "severity": "critical",
                    "line": code.count('\n', 0, match.start()) + 1,
                    "match": match.group(0)
                })
        
        return {
            "safe": len(issues) == 0,
            "issues": issues
        }

    def check_tool_safety(self, tool_request: Dict[str, Any]) -> Dict[str, Any]:
        """Check tool usage safety."""
        issues = []
        
        # Check tool permissions
        if tool_request.get("name") in ["system_command", "file_write"]:
            return {
                "safe": False,
                "reason": "insufficient_permissions",
                "issues": [{
                    "type": "unsafe_tool",
                    "severity": "critical",
                    "details": f"Tool {tool_request['name']} requires elevated permissions"
                }]
            }
        
        # Check argument safety
        args = tool_request.get("args", [])
        for arg in args:
            if isinstance(arg, str):
                # Check for dangerous paths
                if any(dangerous in arg.lower() for dangerous in ["/etc/", "/usr/", "/var/", "~/"]):
                    issues.append({
                        "type": "unsafe_path",
                        "severity": "critical",
                        "details": f"Potentially dangerous path: {arg}"
                    })
        
        return {
            "safe": len(issues) == 0,
            "issues": issues
        }

    def check_resource_limits(self, code: str) -> Dict[str, Any]:
        """Check for potential resource usage issues."""
        issues = []
        
        # Check for resource-intensive patterns
        for pattern in self.resource_patterns:
            matches = re.finditer(pattern, code)
            for match in matches:
                issue_type = "infinite_loop" if "while True" in match.group(0) else "memory_limit"
                issues.append({
                    "type": issue_type,
                    "severity": "high" if issue_type == "memory_limit" else "medium",
                    "line": code.count('\n', 0, match.start()) + 1,
                    "match": match.group(0)
                })
        
        return {
            "safe": len(issues) == 0,
            "issues": issues
        }

    def check_content_safety(self, content: str) -> Dict[str, Any]:
        """Check content for safety issues and PII."""
        issues = []
        
        # Check for harmful content patterns
        harmful_patterns = [
            r"(?i)virus",
            r"(?i)malware",
            r"(?i)exploit",
            r"(?i)hack\s+into",
        ]
        
        for pattern in harmful_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": "harmful_content",
                    "severity": "high",
                    "match": match.group(0)
                })
        
        # Check for PII
        for pattern in self.pii_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                issues.append({
                    "type": "pii_detected",
                    "severity": "high",
                    "match": match.group(0)
                })
        
        return {
            "safe": len(issues) == 0,
            "issues": issues
        }

    def check_all_safety(self, content: str) -> Dict[str, Any]:
        """Run all safety checks on the content."""
        all_issues = []
        
        # Run all checks
        code_safety = self.check_code_safety(content)
        all_issues.extend(code_safety["issues"])
        
        resource_safety = self.check_resource_limits(content)
        all_issues.extend(resource_safety["issues"])
        
        content_safety = self.check_content_safety(content)
        all_issues.extend(content_safety["issues"])
        
        return {
            "safe": len(all_issues) == 0,
            "issues": all_issues
        } 