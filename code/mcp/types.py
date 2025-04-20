"""
Core types for the MCP package.
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class Resource:
    """A resource that can be accessed by clients."""
    uri: str
    description: str

@dataclass
class Prompt:
    """A prompt template that can be used by clients."""
    name: str
    description: str
    arguments: List[Dict[str, Any]] 