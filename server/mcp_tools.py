"""
MCP Tools - Implementation of basic Model Context Protocol tools.
Includes web search, file system access, and REST API connector.
"""

import asyncio
import aiohttp
import aiofiles
import os
import json
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class BaseMCPTool(ABC):
    """Base class for all MCP tools."""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.config: Dict[str, Any] = {}

    @abstractmethod
    async def execute(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute the tool with the given query."""
        pass

    def configure(self, config: Dict[str, Any]):
        """Configure the tool with provided settings."""
        self.config.update(config)

    def get_schema(self) -> Dict[str, Any]:
        """Get the configuration schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "default": True}
            }
        }

class WebSearchTool(BaseMCPTool):
    """Web search tool using Tavily API."""

    def __init__(self):
        super().__init__("web_search", "Search the web for current information")
        self.api_key = None
        self.base_url = "https://api.tavily.com/search"

    async def execute(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute web search."""
        try:
            if not self.api_key:
                # Try to use existing Tavily integration from the app
                return await self._use_existing_tavily(query)

            # Use direct Tavily API call
            async with aiohttp.ClientSession() as session:
                payload = {
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": kwargs.get("max_results", 4),
                    "search_depth": "basic"
                }

                async with session.post(self.base_url, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "content": self._format_search_results(data.get("results", [])),
                            "metadata": {
                                "source": "tavily_web_search",
                                "query": query,
                                "result_count": len(data.get("results", []))
                            }
                        }
                    else:
                        raise Exception(f"Search API error: {response.status}")

        except Exception as e:
            logger.error(f"Web search error: {e}")
            return {
                "content": f"Web search failed: {str(e)}",
                "metadata": {"source": "web_search", "error": True}
            }

    async def _use_existing_tavily(self, query: str) -> Dict[str, Any]:
        """Use existing Tavily search integration."""
        try:
            # Import the existing search tool
            from langchain_community.tools.tavily_search import TavilySearchResults

            search_tool = TavilySearchResults(max_results=4)
            results = await search_tool.ainvoke({"query": query})

            return {
                "content": self._format_tavily_results(results),
                "metadata": {
                    "source": "tavily_integration",
                    "query": query,
                    "result_count": len(results) if isinstance(results, list) else 1
                }
            }

        except Exception as e:
            logger.error(f"Tavily integration error: {e}")
            return {
                "content": f"Web search unavailable: {str(e)}",
                "metadata": {"source": "web_search", "error": True}
            }

    def _format_search_results(self, results: List[Dict]) -> str:
        """Format search results for display."""
        if not results:
            return "No search results found."

        formatted = "## Web Search Results\n\n"
        for i, result in enumerate(results, 1):
            title = result.get("title", "Untitled")
            url = result.get("url", "")
            content = result.get("content", "")[:200] + "..."

            formatted += f"**{i}. {title}**\n"
            formatted += f"URL: {url}\n"
            formatted += f"Content: {content}\n\n"

        return formatted

    def _format_tavily_results(self, results: Any) -> str:
        """Format Tavily integration results."""
        if isinstance(results, str):
            return f"## Web Search Results\n\n{results}"
        elif isinstance(results, list):
            return self._format_search_results(results)
        else:
            return f"## Web Search Results\n\n{str(results)}"

    def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema."""
        return {
            "type": "object",
            "properties": {
                "api_key": {"type": "string", "description": "Tavily API key"},
                "max_results": {"type": "integer", "default": 4, "minimum": 1, "maximum": 10},
                "enabled": {"type": "boolean", "default": True}
            }
        }

class FileSystemTool(BaseMCPTool):
    """File system access tool for reading local files."""

    def __init__(self):
        super().__init__("file_system", "Access and read local files")
        self.allowed_paths = []
        self.max_file_size = 1024 * 1024  # 1MB default

    async def execute(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute file system operation."""
        try:
            # Parse query to extract file path or search pattern
            file_path = self._extract_file_path(query)

            if not file_path:
                return {
                    "content": "No file path specified in query.",
                    "metadata": {"source": "file_system", "error": True}
                }

            # Security check
            if not self._is_path_allowed(file_path):
                return {
                    "content": f"Access denied: {file_path} is not in allowed paths.",
                    "metadata": {"source": "file_system", "error": True}
                }

            if os.path.isfile(file_path):
                return await self._read_file(file_path)
            elif os.path.isdir(file_path):
                return await self._list_directory(file_path)
            else:
                return {
                    "content": f"Path not found: {file_path}",
                    "metadata": {"source": "file_system", "error": True}
                }

        except Exception as e:
            logger.error(f"File system error: {e}")
            return {
                "content": f"File system operation failed: {str(e)}",
                "metadata": {"source": "file_system", "error": True}
            }

    def _extract_file_path(self, query: str) -> Optional[str]:
        """Extract file path from query."""
        # Simple extraction - look for file paths in query
        words = query.split()
        for word in words:
            if "/" in word or "\\" in word or word.endswith(('.txt', '.md', '.py', '.js', '.json')):
                # Handle company_documents/filename.txt pattern
                if word.startswith('company_documents/') and self.allowed_paths:
                    # Remove the company_documents/ prefix and join with allowed path
                    filename = word.replace('company_documents/', '')
                    return os.path.join(self.allowed_paths[0], filename)
                # If path is relative, make it absolute to allowed directory
                elif not word.startswith('/') and self.allowed_paths:
                    return os.path.join(self.allowed_paths[0], word)
                return word

        # Also check if query mentions a directory name
        if 'company_documents' in query.lower() and 'sample.txt' not in query:
            if self.allowed_paths:
                return self.allowed_paths[0]

        return None

    def _is_path_allowed(self, file_path: str) -> bool:
        """Check if file path is allowed."""
        if not self.allowed_paths:
            # If no restrictions set, allow uploads directory only
            return file_path.startswith("./uploads/")

        # Convert to absolute path for comparison
        if not os.path.isabs(file_path):
            abs_path = os.path.abspath(file_path)
        else:
            abs_path = file_path

        for allowed in self.allowed_paths:
            allowed_abs = os.path.abspath(allowed)
            if abs_path.startswith(allowed_abs):
                return True
        return False

    async def _read_file(self, file_path: str) -> Dict[str, Any]:
        """Read file content."""
        try:
            file_size = os.path.getsize(file_path)
            if file_size > self.max_file_size:
                return {
                    "content": f"File too large: {file_size} bytes (max: {self.max_file_size})",
                    "metadata": {"source": "file_system", "error": True}
                }

            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()

            return {
                "content": f"## File Content: {file_path}\n\n```\n{content}\n```",
                "metadata": {
                    "source": "file_system",
                    "file_path": file_path,
                    "file_size": file_size
                }
            }

        except UnicodeDecodeError:
            return {
                "content": f"File {file_path} contains binary data and cannot be displayed as text.",
                "metadata": {"source": "file_system", "error": True}
            }

    async def _list_directory(self, dir_path: str) -> Dict[str, Any]:
        """List directory contents."""
        try:
            entries = []
            for entry in os.listdir(dir_path):
                entry_path = os.path.join(dir_path, entry)
                entry_type = "directory" if os.path.isdir(entry_path) else "file"
                size = os.path.getsize(entry_path) if os.path.isfile(entry_path) else None

                entries.append({
                    "name": entry,
                    "type": entry_type,
                    "size": size
                })

            content = f"## Directory Contents: {dir_path}\n\n"
            for entry in entries:
                size_str = f" ({entry['size']} bytes)" if entry['size'] else ""
                content += f"- **{entry['name']}** ({entry['type']}){size_str}\n"

            return {
                "content": content,
                "metadata": {
                    "source": "file_system",
                    "directory": dir_path,
                    "entry_count": len(entries)
                }
            }

        except PermissionError:
            return {
                "content": f"Permission denied accessing directory: {dir_path}",
                "metadata": {"source": "file_system", "error": True}
            }

    def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema."""
        return {
            "type": "object",
            "properties": {
                "allowed_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of allowed file paths"
                },
                "max_file_size": {
                    "type": "integer",
                    "default": 1048576,
                    "description": "Maximum file size in bytes"
                },
                "enabled": {"type": "boolean", "default": True}
            }
        }

class RestApiTool(BaseMCPTool):
    """Generic REST API connector tool."""

    def __init__(self):
        super().__init__("rest_api", "Connect to REST APIs for data retrieval")
        self.base_url = None
        self.headers = {}
        self.timeout = 30

    async def execute(self, query: str, **kwargs) -> Dict[str, Any]:
        """Execute REST API call."""
        try:
            # Parse query to extract API endpoint and parameters
            api_info = self._parse_api_query(query)

            if not api_info:
                return {
                    "content": "Unable to parse API request from query.",
                    "metadata": {"source": "rest_api", "error": True}
                }

            url = api_info.get("url")
            method = api_info.get("method", "GET").upper()
            params = api_info.get("params", {})

            if not url:
                return {
                    "content": "No API URL specified.",
                    "metadata": {"source": "rest_api", "error": True}
                }

            # Make API request
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.request(method, url, params=params, headers=self.headers) as response:
                    if response.status == 200:
                        data = await response.json()

                        return {
                            "content": self._format_api_response(data, url),
                            "metadata": {
                                "source": "rest_api",
                                "url": url,
                                "status": response.status,
                                "method": method
                            }
                        }
                    else:
                        return {
                            "content": f"API request failed: {response.status} - {await response.text()}",
                            "metadata": {"source": "rest_api", "error": True}
                        }

        except Exception as e:
            logger.error(f"REST API error: {e}")
            return {
                "content": f"API request failed: {str(e)}",
                "metadata": {"source": "rest_api", "error": True}
            }

    def _parse_api_query(self, query: str) -> Optional[Dict[str, Any]]:
        """Parse query to extract API request information."""
        # Simple parsing - look for URLs and HTTP methods
        words = query.lower().split()

        # Look for HTTP methods
        method = "GET"
        for word in words:
            if word in ["get", "post", "put", "delete", "patch"]:
                method = word.upper()
                break

        # Look for URLs
        url = None
        for word in query.split():
            if word.startswith("http://") or word.startswith("https://"):
                url = word
                break

        if not url and self.base_url:
            # Try to construct URL with base_url
            for word in words:
                if "/" in word and not word.startswith("http"):
                    url = self.base_url.rstrip("/") + "/" + word.lstrip("/")
                    break

        return {
            "url": url,
            "method": method,
            "params": {}
        } if url else None

    def _format_api_response(self, data: Any, url: str) -> str:
        """Format API response for display."""
        content = f"## API Response from {url}\n\n"

        if isinstance(data, dict):
            content += "```json\n"
            content += json.dumps(data, indent=2)
            content += "\n```"
        elif isinstance(data, list):
            content += f"Received {len(data)} items:\n\n"
            for i, item in enumerate(data[:5]):  # Show first 5 items
                content += f"**Item {i+1}:**\n"
                content += f"```json\n{json.dumps(item, indent=2)}\n```\n\n"
            if len(data) > 5:
                content += f"... and {len(data) - 5} more items"
        else:
            content += str(data)

        return content

    def get_schema(self) -> Dict[str, Any]:
        """Get configuration schema."""
        return {
            "type": "object",
            "properties": {
                "base_url": {
                    "type": "string",
                    "description": "Base URL for API requests"
                },
                "headers": {
                    "type": "object",
                    "description": "Default headers for requests"
                },
                "timeout": {
                    "type": "integer",
                    "default": 30,
                    "description": "Request timeout in seconds"
                },
                "enabled": {"type": "boolean", "default": True}
            }
        }

# Tool registry
TOOL_CLASSES = {
    "web_search": WebSearchTool,
    "file_system": FileSystemTool,
    "rest_api": RestApiTool
}

def get_tool_class(tool_name: str) -> Optional[BaseMCPTool]:
    """Get tool class by name."""
    return TOOL_CLASSES.get(tool_name)

def get_available_tools() -> List[str]:
    """Get list of available tool names."""
    return list(TOOL_CLASSES.keys())

def create_tool_instance(tool_name: str, config: Dict[str, Any] = None) -> Optional[BaseMCPTool]:
    """Create and configure tool instance."""
    tool_class = get_tool_class(tool_name)
    if tool_class:
        instance = tool_class()
        if config:
            instance.configure(config)
        return instance
    return None