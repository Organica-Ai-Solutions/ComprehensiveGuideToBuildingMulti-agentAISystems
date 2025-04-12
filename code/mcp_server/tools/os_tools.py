import os
import sys
import platform
import psutil
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import subprocess
from .base import ToolRegistry, Tool, ToolOutput

logger = logging.getLogger(__name__)

class OSTools(ToolRegistry):
    """Operating system tools for file and system operations."""

    def __init__(self, base_dir: Optional[str] = None):
        super().__init__("os")
        
        # Set a base directory for file operations to prevent access to the entire filesystem
        # Default to current working directory if not specified
        self.base_dir = Path(base_dir or os.getcwd()).resolve()
        logger.info(f"OS Tools initialized with base directory: {self.base_dir}")
        
        # Register file operation tools
        self.register_tool(
            Tool(
                name="list_directory",
                description="List files and directories in a specified path",
                function=self.list_directory,
                parameters={
                    "path": {
                        "type": "string",
                        "description": "Relative path to list (relative to base directory)",
                        "default": "."
                    },
                },
            )
        )
        
        self.register_tool(
            Tool(
                name="read_file",
                description="Read content from a file",
                function=self.read_file,
                parameters={
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file (relative to base directory)",
                    },
                    "max_length": {
                        "type": "integer",
                        "description": "Maximum length of content to return (default 4000)",
                        "default": 4000,
                    },
                },
            )
        )
        
        # Register system information tools
        self.register_tool(
            Tool(
                name="system_info",
                description="Get system information including OS, CPU, memory",
                function=self.system_info,
                parameters={},
            )
        )

    def _resolve_path(self, path: str) -> Path:
        """
        Resolve a user-provided path relative to the base directory.
        Prevents path traversal outside the base directory.
        
        Args:
            path: User-provided relative path
            
        Returns:
            Resolved absolute Path object
        
        Raises:
            ValueError if path attempts to escape base directory
        """
        # Convert to absolute path
        requested_path = (self.base_dir / path).resolve()
        
        # Check if the resolved path is within the allowed base directory
        if not str(requested_path).startswith(str(self.base_dir)):
            raise ValueError(f"Access denied: Path '{path}' attempts to escape the base directory")
            
        return requested_path

    async def list_directory(self, path: str = ".") -> ToolOutput:
        """
        List files and directories in the specified path.
        
        Args:
            path: Relative path to list (relative to base directory)
            
        Returns:
            List of files and directories with metadata
        """
        try:
            resolved_path = self._resolve_path(path)
            
            if not resolved_path.exists():
                return ToolOutput(
                    error=f"Path does not exist: {path}"
                )
                
            if not resolved_path.is_dir():
                return ToolOutput(
                    error=f"Path is not a directory: {path}"
                )
            
            # Get directory contents
            contents = []
            for item in resolved_path.iterdir():
                item_type = "directory" if item.is_dir() else "file"
                size = 0 if item.is_dir() else item.stat().st_size
                
                contents.append({
                    "name": item.name,
                    "type": item_type,
                    "size": size,
                    "is_dir": item.is_dir()
                })
                
            # Sort directories first, then files
            contents.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
            
            return ToolOutput(
                content=contents,
                metadata={
                    "path": str(resolved_path.relative_to(self.base_dir)),
                    "count": len(contents)
                }
            )
            
        except ValueError as e:
            return ToolOutput(
                error=str(e)
            )
        except Exception as e:
            return ToolOutput(
                error=f"Error listing directory: {str(e)}"
            )

    async def read_file(self, path: str, max_length: int = 4000) -> ToolOutput:
        """
        Read content from a file.
        
        Args:
            path: Relative path to the file (relative to base directory)
            max_length: Maximum length of content to return
            
        Returns:
            File content, potentially truncated
        """
        try:
            resolved_path = self._resolve_path(path)
            
            if not resolved_path.exists():
                return ToolOutput(
                    error=f"File does not exist: {path}"
                )
                
            if not resolved_path.is_file():
                return ToolOutput(
                    error=f"Path is not a file: {path}"
                )
            
            # Check file size
            file_size = resolved_path.stat().st_size
            if file_size > 10 * 1024 * 1024:  # 10MB limit
                return ToolOutput(
                    error=f"File is too large to read: {file_size} bytes"
                )
            
            # Read file content
            with open(resolved_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read(max_length)
            
            truncated = file_size > max_length
            
            return ToolOutput(
                content=content,
                metadata={
                    "path": str(resolved_path.relative_to(self.base_dir)),
                    "size": file_size,
                    "truncated": truncated
                }
            )
            
        except ValueError as e:
            return ToolOutput(
                error=str(e)
            )
        except UnicodeDecodeError:
            return ToolOutput(
                error=f"File is not a text file or uses an unsupported encoding: {path}"
            )
        except Exception as e:
            return ToolOutput(
                error=f"Error reading file: {str(e)}"
            )

    async def system_info(self) -> ToolOutput:
        """
        Get basic system information.
        
        Returns:
            System information including OS, CPU, memory
        """
        try:
            info = {
                "os": {
                    "name": os.name,
                    "system": platform.system(),
                    "release": platform.release(),
                    "version": platform.version(),
                },
                "python": {
                    "version": sys.version,
                    "implementation": platform.python_implementation(),
                },
                "cpu": {
                    "count": psutil.cpu_count(logical=False),
                    "logical_count": psutil.cpu_count(logical=True),
                    "usage_percent": psutil.cpu_percent(interval=0.1),
                },
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "used_percent": psutil.virtual_memory().percent,
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "used": psutil.disk_usage('/').used,
                    "free": psutil.disk_usage('/').free,
                    "used_percent": psutil.disk_usage('/').percent,
                }
            }
            
            # Convert bytes to more readable format
            for key in ["total", "available"]:
                info["memory"][key] = self._format_bytes(info["memory"][key])
                
            for key in ["total", "used", "free"]:
                info["disk"][key] = self._format_bytes(info["disk"][key])
            
            return ToolOutput(
                content=info
            )
            
        except Exception as e:
            return ToolOutput(
                error=f"Error getting system info: {str(e)}"
            )
    
    def _format_bytes(self, size_bytes: int) -> str:
        """Format bytes to a human-readable string."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 ** 2:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 ** 3:
            return f"{size_bytes / (1024 ** 2):.2f} MB"
        else:
            return f"{size_bytes / (1024 ** 3):.2f} GB" 