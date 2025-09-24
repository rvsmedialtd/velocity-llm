"""
MCP Manager - Core service for Model Context Protocol integration.
Handles tool discovery, connection management, and execution coordination.
"""

import json
import asyncio
import time
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from database import MCPToolDB, MCPConnectionDB, MCPUsageLogDB, ToolPermissionDB
import logging

logger = logging.getLogger(__name__)

@dataclass
class MCPToolResult:
    """Result from MCP tool execution."""
    tool_name: str
    status: str  # 'success', 'error', 'timeout'
    content: str
    metadata: Dict[str, Any]
    execution_time: float
    error_message: Optional[str] = None

@dataclass
class MCPExecutionContext:
    """Context for MCP tool execution."""
    user_id: int
    user_role: str
    query: str
    max_execution_time: float = 30.0
    parallel_execution: bool = True

class MCPManager:
    """Main MCP manager for handling tool discovery and execution."""

    def __init__(self):
        self.tools_registry: Dict[str, Any] = {}
        self.active_connections: Dict[int, Any] = {}
        self.tool_instances: Dict[str, Any] = {}
        self._initialize_builtin_tools()

    def _initialize_builtin_tools(self):
        """Initialize built-in MCP tools."""
        # This will be populated with tool implementations
        pass

    async def discover_tools(self) -> List[Dict[str, Any]]:
        """Discover available MCP tools from database and external sources."""
        try:
            # Get tools from database
            db_tools = MCPToolDB.get_enabled_tools()

            # Format tools for discovery response
            tools = []
            for tool in db_tools:
                tools.append({
                    'id': tool['id'],
                    'name': tool['name'],
                    'type': tool['tool_type'],
                    'description': tool['description'],
                    'config_schema': json.loads(tool['config_schema']) if tool['config_schema'] else {},
                    'enabled': tool['is_enabled']
                })

            logger.info(f"Discovered {len(tools)} MCP tools")
            return tools

        except Exception as e:
            logger.error(f"Error discovering tools: {e}")
            return []

    async def register_tool(self, name: str, tool_type: str, description: str,
                          config_schema: Dict[str, Any], created_by: int) -> Optional[int]:
        """Register a new MCP tool."""
        try:
            config_schema_json = json.dumps(config_schema)
            tool_id = MCPToolDB.create_tool(name, tool_type, description, config_schema_json, created_by)

            if tool_id:
                logger.info(f"Registered MCP tool: {name} (ID: {tool_id})")
                # Set default permissions for admin role
                ToolPermissionDB.create_permission(tool_id, 'admin', 'execute', True, created_by)
                ToolPermissionDB.create_permission(tool_id, 'super_admin', 'execute', True, created_by)
                ToolPermissionDB.create_permission(tool_id, 'user', 'execute', False, created_by)

            return tool_id

        except Exception as e:
            logger.error(f"Error registering tool {name}: {e}")
            return None

    async def create_connection(self, tool_id: int, name: str, endpoint: str,
                              config: Dict[str, Any], credentials: Dict[str, Any],
                              created_by: int) -> Optional[int]:
        """Create a new MCP connection for a tool."""
        try:
            config_json = json.dumps(config)
            credentials_json = json.dumps(credentials)

            connection_id = MCPConnectionDB.create_connection(
                tool_id, name, endpoint, config_json, credentials_json, created_by
            )

            if connection_id:
                logger.info(f"Created MCP connection: {name} (ID: {connection_id})")
                # Test the connection
                await self._test_connection(connection_id)

            return connection_id

        except Exception as e:
            logger.error(f"Error creating connection {name}: {e}")
            return None

    async def _test_connection(self, connection_id: int) -> bool:
        """Test an MCP connection."""
        try:
            # Placeholder for connection testing logic
            # In a real implementation, this would test the actual MCP connection
            status = "active"  # or "inactive" based on test result
            MCPConnectionDB.update_connection_status(connection_id, status, str(time.time()))
            return status == "active"

        except Exception as e:
            logger.error(f"Error testing connection {connection_id}: {e}")
            MCPConnectionDB.update_connection_status(connection_id, "error")
            return False

    async def execute_tools(self, context: MCPExecutionContext,
                           tool_names: List[str]) -> List[MCPToolResult]:
        """Execute specified MCP tools with the given context."""
        results = []

        try:
            if context.parallel_execution:
                # Execute tools in parallel
                tasks = [self._execute_single_tool(context, tool_name) for tool_name in tool_names]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Handle exceptions
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        results[i] = MCPToolResult(
                            tool_name=tool_names[i],
                            status='error',
                            content='',
                            metadata={},
                            execution_time=0.0,
                            error_message=str(result)
                        )
            else:
                # Execute tools sequentially
                for tool_name in tool_names:
                    result = await self._execute_single_tool(context, tool_name)
                    results.append(result)

            # Log usage for all tools
            for result in results:
                await self._log_tool_usage(context, result)

            return results

        except Exception as e:
            logger.error(f"Error executing tools: {e}")
            return [MCPToolResult(
                tool_name=tool,
                status='error',
                content='',
                metadata={},
                execution_time=0.0,
                error_message=str(e)
            ) for tool in tool_names]

    async def _execute_single_tool(self, context: MCPExecutionContext,
                                 tool_name: str) -> MCPToolResult:
        """Execute a single MCP tool."""
        start_time = time.time()

        try:
            # Check permissions
            if not await self._check_tool_permission(tool_name, context.user_role):
                return MCPToolResult(
                    tool_name=tool_name,
                    status='error',
                    content='',
                    metadata={},
                    execution_time=time.time() - start_time,
                    error_message='Insufficient permissions'
                )

            # Get tool implementation
            tool_instance = await self._get_tool_instance(tool_name)
            if not tool_instance:
                return MCPToolResult(
                    tool_name=tool_name,
                    status='error',
                    content='',
                    metadata={},
                    execution_time=time.time() - start_time,
                    error_message='Tool not found or not available'
                )

            # Execute tool with timeout
            try:
                result = await asyncio.wait_for(
                    tool_instance.execute(context.query),
                    timeout=context.max_execution_time
                )

                return MCPToolResult(
                    tool_name=tool_name,
                    status='success',
                    content=result.get('content', ''),
                    metadata=result.get('metadata', {}),
                    execution_time=time.time() - start_time
                )

            except asyncio.TimeoutError:
                return MCPToolResult(
                    tool_name=tool_name,
                    status='timeout',
                    content='',
                    metadata={},
                    execution_time=time.time() - start_time,
                    error_message='Tool execution timeout'
                )

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return MCPToolResult(
                tool_name=tool_name,
                status='error',
                content='',
                metadata={},
                execution_time=time.time() - start_time,
                error_message=str(e)
            )

    async def _get_tool_instance(self, tool_name: str) -> Optional[Any]:
        """Get or create tool instance."""
        if tool_name in self.tool_instances:
            return self.tool_instances[tool_name]

        # Import and create tool instance dynamically
        try:
            # This will be implemented with actual tool classes
            from mcp_tools import get_tool_class
            tool_class = get_tool_class(tool_name)
            if tool_class:
                instance = tool_class()
                self.tool_instances[tool_name] = instance
                return instance
        except ImportError:
            logger.warning(f"Tool implementation not found: {tool_name}")

        return None

    async def _check_tool_permission(self, tool_name: str, user_role: str) -> bool:
        """Check if user role has permission to execute tool."""
        try:
            # Get tool by name
            tools = MCPToolDB.get_all_tools()
            tool = next((t for t in tools if t['name'] == tool_name), None)

            if not tool:
                return False

            # Check permission
            return ToolPermissionDB.check_permission(tool['id'], user_role, 'execute')

        except Exception as e:
            logger.error(f"Error checking tool permission: {e}")
            return False

    async def _log_tool_usage(self, context: MCPExecutionContext, result: MCPToolResult):
        """Log tool usage for analytics."""
        try:
            # Get tool and connection IDs (simplified for now)
            tools = MCPToolDB.get_all_tools()
            tool = next((t for t in tools if t['name'] == result.tool_name), None)

            if tool:
                MCPUsageLogDB.log_usage(
                    tool_id=tool['id'],
                    connection_id=None,  # Will be updated when connections are implemented
                    user_id=context.user_id,
                    query=context.query,
                    response_summary=result.content[:200] if result.content else '',
                    execution_time=result.execution_time,
                    status=result.status,
                    error_message=result.error_message
                )

        except Exception as e:
            logger.error(f"Error logging tool usage: {e}")

    async def get_tool_analytics(self, tool_id: int = None, days: int = 30) -> Dict[str, Any]:
        """Get analytics for tool usage."""
        try:
            usage_logs = MCPUsageLogDB.get_usage_stats(tool_id=tool_id, days=days)

            # Calculate analytics
            total_uses = len(usage_logs)
            successful_uses = len([log for log in usage_logs if log['status'] == 'success'])
            avg_execution_time = sum(log['execution_time'] for log in usage_logs) / max(total_uses, 1)

            return {
                'total_uses': total_uses,
                'successful_uses': successful_uses,
                'success_rate': successful_uses / max(total_uses, 1),
                'average_execution_time': avg_execution_time,
                'usage_by_day': self._group_usage_by_day(usage_logs)
            }

        except Exception as e:
            logger.error(f"Error getting tool analytics: {e}")
            return {}

    def _group_usage_by_day(self, usage_logs: List[Dict[str, Any]]) -> Dict[str, int]:
        """Group usage logs by day."""
        usage_by_day = {}
        for log in usage_logs:
            day = log['timestamp'][:10]  # Extract date part
            usage_by_day[day] = usage_by_day.get(day, 0) + 1
        return usage_by_day

# Global instance
mcp_manager = MCPManager()