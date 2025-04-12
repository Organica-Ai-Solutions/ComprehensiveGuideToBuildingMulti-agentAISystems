import httpx
import re
from typing import Dict, Any
from bs4 import BeautifulSoup
from .base import ToolRegistry, Tool, ToolOutput
import logging
import asyncio
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class BrowserTools(ToolRegistry):
    """Browser tools for web browsing capabilities."""

    def __init__(self):
        super().__init__("browser")
        self.http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        self.register_tool(
            Tool(
                name="fetch_webpage",
                description="Fetch text content from a web page URL",
                function=self.fetch_webpage,
                parameters={
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch content from",
                    },
                    "max_length": {
                        "type": "integer",
                        "description": "Maximum length of content to return (default 2000)",
                        "default": 2000,
                    },
                },
            )
        )
        self.register_tool(
            Tool(
                name="search_query",
                description="Perform a search query and get summarized results",
                function=self.search_query,
                parameters={
                    "query": {
                        "type": "string",
                        "description": "The search query to perform",
                    },
                    "num_results": {
                        "type": "integer", 
                        "description": "Number of results to return (default 5)",
                        "default": 5,
                    }
                },
            )
        )

    async def fetch_webpage(self, url: str, max_length: int = 2000) -> ToolOutput:
        """
        Fetch content from a web page and extract the text.
        
        Args:
            url: The URL to fetch
            max_length: Maximum length of content to return
            
        Returns:
            Extracted text content from the webpage
        """
        try:
            # Validate URL
            parsed_url = urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                return ToolOutput(
                    error=f"Invalid URL: {url}. Must include scheme (http/https) and domain."
                )
            
            # Fetch the webpage
            logger.info(f"Fetching webpage: {url}")
            response = await self.http_client.get(url, headers={
                "User-Agent": "Mozilla/5.0 MCP-Agent/1.0"
            })
            
            # Check if request was successful
            response.raise_for_status()
            
            # Parse with BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "header", "footer", "nav"]):
                script.extract()
                
            # Extract text
            text = soup.get_text(separator='\n', strip=True)
            
            # Clean up text
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            # Truncate if necessary
            if len(text) > max_length:
                text = text[:max_length] + "... [content truncated]"
                
            return ToolOutput(
                content=text,
                metadata={
                    "url": url,
                    "content_length": len(text),
                    "truncated": len(text) > max_length
                }
            )
            
        except httpx.HTTPStatusError as e:
            return ToolOutput(
                error=f"HTTP error occurred: {e.response.status_code} - {e.response.reason_phrase}"
            )
        except httpx.RequestError as e:
            return ToolOutput(
                error=f"Request error occurred: {str(e)}"
            )
        except Exception as e:
            return ToolOutput(
                error=f"Error fetching webpage: {str(e)}"
            )

    async def search_query(self, query: str, num_results: int = 5) -> ToolOutput:
        """
        Simulated search function.
        
        Note: This is a simplified implementation. In a production system, 
        you would integrate with a real search API like Google Custom Search, Bing, etc.
        
        Args:
            query: The search query
            num_results: Number of results to return
            
        Returns:
            Search results as text
        """
        # This is a placeholder for a real search implementation
        try:
            logger.info(f"Performing search for: {query}")
            
            # In a real implementation, this would call a search API
            # For now, we'll return a message about the limitation
            return ToolOutput(
                content=f"Search for '{query}' - NOTE: This is a simulated search function.\n\n"
                        f"To implement a real search function, you would need to:\n"
                        f"1. Sign up for a search API (Google Custom Search, Bing API, etc.)\n"
                        f"2. Replace this method with actual API calls\n"
                        f"3. Parse and format the results\n\n"
                        f"The implementation would be similar to the fetch_webpage function,\n"
                        f"but would call the search API endpoint instead.",
                metadata={
                    "query": query,
                    "num_results": num_results,
                    "simulated": True
                }
            )
            
        except Exception as e:
            return ToolOutput(
                error=f"Error performing search: {str(e)}"
            )
            
    async def close(self):
        """Close the HTTP client on shutdown."""
        await self.http_client.aclose() 