"""
MCP (Multi-Component Protocol) package.
"""

from .types import Resource, Prompt
from .client.stdio import stdio_client

__all__ = ['Resource', 'Prompt', 'stdio_client'] 