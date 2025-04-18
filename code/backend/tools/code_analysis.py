"""
Code Analysis Tool for Multi-Agent AI System

This module provides a simulated code analysis functionality for the agents.
In a production system, this would use real code analysis tools.
"""

import json
import re
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common code issues and patterns
CODE_PATTERNS = {
    "python": {
        "unused_import": r"import\s+([a-zA-Z0-9_]+)(?!.*\1)",
        "unused_variable": r"([a-zA-Z0-9_]+)\s*=\s*[^=]+(?!.*\1)",
        "missing_docstring": r"def\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*:",
        "too_complex": r"(if|for|while).*((if|for|while).*){3,}",
        "line_too_long": r".{80,}",
        "bare_except": r"except\s*:",
    },
    "javascript": {
        "unused_variable": r"(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*[^=]+(?!.*\2)",
        "console_log": r"console\.log\(",
        "==_vs_===": r"==(?!=)",
        "line_too_long": r".{80,}",
        "missing_semicolon": r"[^;{}\s]\s*$",
    },
    "html": {
        "missing_alt": r"<img[^>]*(?!alt=)[^>]*>",
        "missing_title": r"<a[^>]*(?!title=)[^>]*>",
        "deprecated_tag": r"<(center|font|marquee|blink)[^>]*>",
    },
    "css": {
        "important": r"!important",
        "px_vs_rem": r"\d+px",
        "id_selector": r"#[a-zA-Z0-9_-]+",
    }
}

# Code improvement suggestions
CODE_IMPROVEMENTS = {
    "python": [
        "Consider using meaningful variable names",
        "Add type hints to function parameters",
        "Use f-strings instead of string concatenation",
        "Consider breaking down complex functions",
        "Add docstrings to functions and classes",
        "Use context managers for file operations",
        "Consider using list comprehensions for simple loops",
        "Implement error handling with specific exception types",
        "Add unit tests",
        "Consider using dataclasses for data containers"
    ],
    "javascript": [
        "Use const for variables that don't change",
        "Consider using template literals instead of string concatenation",
        "Replace callbacks with async/await where possible",
        "Use === instead of == for comparison",
        "Consider using arrow functions for brevity",
        "Add JSDoc comments to functions",
        "Consider using destructuring for cleaner code",
        "Remove console.log statements in production code",
        "Add error handling with try/catch blocks",
        "Consider using modern ES6+ features"
    ],
    "html": [
        "Ensure all images have alt attributes",
        "Use semantic HTML elements",
        "Ensure proper nesting of elements",
        "Add appropriate ARIA attributes for accessibility",
        "Ensure form elements have labels",
        "Use viewport meta tag for responsive design",
        "Consider adding proper meta tags for SEO",
        "Validate HTML structure",
        "Ensure proper document structure with doctype, html, head, body",
        "Use consistent indentation"
    ],
    "css": [
        "Consider using CSS variables for repeated values",
        "Use rem instead of px for better accessibility",
        "Consider mobile-first approach with media queries",
        "Group related CSS properties",
        "Minimize use of !important",
        "Use class selectors instead of ID selectors for reusability",
        "Consider using Flexbox or Grid for layouts",
        "Use shorthand properties where possible",
        "Add comments for complex styling rules",
        "Consider using CSS preprocessors for large projects"
    ]
}

def analyze_code(code: str, language: str) -> Dict[str, Any]:
    """
    Analyze code for potential issues and improvements
    
    Args:
        code: The code string to analyze
        language: The programming language of the code
        
    Returns:
        Dictionary containing analysis results
    """
    logger.info(f"Analyzing {language} code")
    
    if language not in CODE_PATTERNS:
        return {
            "error": f"Unsupported language: {language}",
            "status": "error"
        }
    
    issues = []
    
    # Find pattern matches
    patterns = CODE_PATTERNS[language]
    for issue_type, pattern in patterns.items():
        matches = re.finditer(pattern, code, re.MULTILINE)
        for match in matches:
            line_num = code[:match.start()].count('\n') + 1
            column = match.start() - code[:match.start()].rfind('\n') if code[:match.start()].rfind('\n') >= 0 else match.start() + 1
            
            issues.append({
                "type": issue_type,
                "line": line_num,
                "column": column,
                "match": match.group(0)[:30] + ("..." if len(match.group(0)) > 30 else ""),
                "message": f"Potential {issue_type.replace('_', ' ')} issue detected"
            })
    
    # Select random improvement suggestions
    import random
    improvements = random.sample(
        CODE_IMPROVEMENTS[language], 
        min(3, len(CODE_IMPROVEMENTS[language]))
    )
    
    # Count lines of code
    line_count = code.count('\n') + 1
    
    return {
        "language": language,
        "line_count": line_count,
        "issues": issues,
        "issue_count": len(issues),
        "improvements": improvements,
        "timestamp": datetime.now().isoformat()
    }

async def process_code_analysis(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a code analysis request and return results
    
    Args:
        request_data: Dictionary containing the code analysis request parameters
        
    Returns:
        Dictionary containing the analysis results
    """
    code = request_data.get("code", "")
    if not code:
        return {
            "error": "No code provided",
            "status": "error"
        }
    
    language = request_data.get("language", "").lower()
    if not language:
        # Try to detect language
        if "def " in code or "import " in code:
            language = "python"
        elif "function " in code or "const " in code or "let " in code:
            language = "javascript"
        elif "<html" in code.lower() or "<body" in code.lower():
            language = "html"
        elif "{" in code and ":" in code and ";" in code:
            language = "css"
        else:
            language = "python"  # Default to Python
    
    try:
        results = analyze_code(code, language)
        
        # Format the results for easy reading
        formatted_issues = []
        for issue in results["issues"]:
            formatted_issues.append(
                f"Line {issue['line']}: {issue['message']} - {issue['match']}"
            )
        
        formatted_improvements = [f"- {imp}" for imp in results["improvements"]]
        
        result_text = (
            f"Code Analysis Results ({language}):\n"
            f"Lines of code: {results['line_count']}\n"
            f"Issues found: {results['issue_count']}\n\n"
        )
        
        if formatted_issues:
            result_text += "Issues:\n" + "\n".join(formatted_issues) + "\n\n"
        
        result_text += "Improvement suggestions:\n" + "\n".join(formatted_improvements)
        
        return {
            "status": "success",
            "language": language,
            "line_count": results["line_count"],
            "issues": results["issues"],
            "issue_count": results["issue_count"],
            "improvements": results["improvements"],
            "result_text": result_text,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error analyzing code: {str(e)}")
        return {
            "error": f"Error analyzing code: {str(e)}",
            "status": "error"
        }

# Example code for testing
EXAMPLE_PYTHON_CODE = """
import os
import sys
import re
import json

def process_data(data):
    results = []
    for item in data:
        x = item * 2
        # TODO: Implement this
    return results

def main():
    try:
        data = [1, 2, 3, 4, 5]
        results = process_data(data)
        print(results)
    except:
        pass

if __name__ == "__main__":
    main()
"""

# For testing
if __name__ == "__main__":
    import asyncio
    
    async def test():
        result = await process_code_analysis({
            "code": EXAMPLE_PYTHON_CODE,
            "language": "python"
        })
        print(json.dumps(result, indent=2))
        
    asyncio.run(test()) 