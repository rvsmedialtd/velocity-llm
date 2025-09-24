"""
Tool Selector - Intelligent routing logic for MCP tools and RAG integration.
Determines when to use RAG, MCP tools, or hybrid approach based on query analysis.
"""

import re
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import logging

from rag_utils import search_documents
from mcp_manager import MCPExecutionContext, mcp_manager

logger = logging.getLogger(__name__)

class QueryIntent(Enum):
    """Types of query intents."""
    INTERNAL_KNOWLEDGE = "internal"      # Use RAG for company/internal docs
    EXTERNAL_DATA = "external"           # Use MCP for web/external sources
    HYBRID = "hybrid"                    # Use both RAG and MCP
    FILE_ACCESS = "file_access"          # Access specific files
    API_CALL = "api_call"               # Make API requests
    CURRENT_INFO = "current_info"        # Get real-time/current information

@dataclass
class QueryAnalysis:
    """Result of query intent analysis."""
    intent: QueryIntent
    confidence: float
    suggested_tools: List[str]
    rag_needed: bool
    reasoning: str

@dataclass
class ToolExecutionPlan:
    """Plan for executing tools and RAG."""
    use_rag: bool
    use_mcp: bool
    mcp_tools: List[str]
    execution_strategy: str  # 'parallel', 'sequential', 'rag_first', 'mcp_first'
    max_execution_time: float

class IntentClassifier:
    """Classifies user queries to determine appropriate tools."""

    def __init__(self):
        self.internal_keywords = [
            'company', 'internal', 'policy', 'procedure', 'document', 'manual',
            'our', 'we', 'us', 'team', 'organization', 'department'
        ]

        self.external_keywords = [
            'latest', 'current', 'news', 'trends', 'market', 'industry',
            'today', 'recent', 'now', 'update', 'what is happening'
        ]

        self.file_keywords = [
            'read', 'file', 'document', 'show me', 'open', 'content of',
            'what is in', 'file contains'
        ]

        self.api_keywords = [
            'api', 'endpoint', 'get data from', 'call', 'request',
            'fetch from', 'connect to'
        ]

    def analyze_query(self, query: str, user_context: Dict[str, Any] = None) -> QueryAnalysis:
        """Analyze query to determine intent and suggested tools."""
        query_lower = query.lower()

        # Calculate keyword scores
        internal_score = self._calculate_keyword_score(query_lower, self.internal_keywords)
        external_score = self._calculate_keyword_score(query_lower, self.external_keywords)
        file_score = self._calculate_keyword_score(query_lower, self.file_keywords)
        api_score = self._calculate_keyword_score(query_lower, self.api_keywords)

        # Check for specific patterns
        has_file_path = bool(re.search(r'[./\\][\w./\\]+\.(txt|md|py|js|json|pdf|docx)', query))
        has_url = bool(re.search(r'https?://\S+', query))
        has_time_reference = bool(re.search(r'\b(today|yesterday|now|current|latest|recent)\b', query_lower))

        # Determine primary intent
        intent, confidence, reasoning = self._determine_intent(
            internal_score, external_score, file_score, api_score,
            has_file_path, has_url, has_time_reference, query_lower
        )

        # Suggest appropriate tools
        suggested_tools = self._suggest_tools(intent, query_lower, has_file_path, has_url)

        # Determine if RAG is needed
        rag_needed = intent in [QueryIntent.INTERNAL_KNOWLEDGE, QueryIntent.HYBRID] or internal_score > 0.3

        return QueryAnalysis(
            intent=intent,
            confidence=confidence,
            suggested_tools=suggested_tools,
            rag_needed=rag_needed,
            reasoning=reasoning
        )

    def _calculate_keyword_score(self, query: str, keywords: List[str]) -> float:
        """Calculate keyword match score for query."""
        matches = sum(1 for keyword in keywords if keyword in query)
        return min(matches / len(keywords), 1.0)

    def _determine_intent(self, internal_score: float, external_score: float,
                         file_score: float, api_score: float,
                         has_file_path: bool, has_url: bool,
                         has_time_reference: bool, query: str) -> Tuple[QueryIntent, float, str]:
        """Determine primary intent with confidence score."""

        # File access intent
        if has_file_path or file_score > 0.4:
            return QueryIntent.FILE_ACCESS, 0.9, "Query contains file path or file access keywords"

        # API call intent
        if has_url or api_score > 0.3:
            return QueryIntent.API_CALL, 0.8, "Query contains URL or API-related keywords"

        # Current information intent
        if has_time_reference or external_score > 0.5:
            if internal_score > 0.3:
                return QueryIntent.HYBRID, 0.7, "Query needs both current info and internal knowledge"
            else:
                return QueryIntent.CURRENT_INFO, 0.8, "Query asks for current/recent information"

        # Internal vs external knowledge
        if internal_score > external_score and internal_score > 0.4:
            return QueryIntent.INTERNAL_KNOWLEDGE, 0.7, "Query focuses on internal/company information"
        elif external_score > internal_score and external_score > 0.3:
            return QueryIntent.EXTERNAL_DATA, 0.6, "Query focuses on external information"
        elif internal_score > 0.2 and external_score > 0.2:
            return QueryIntent.HYBRID, 0.6, "Query needs both internal and external information"

        # Default to internal knowledge for company-related systems
        return QueryIntent.INTERNAL_KNOWLEDGE, 0.5, "Default to internal knowledge search"

    def _suggest_tools(self, intent: QueryIntent, query: str,
                      has_file_path: bool, has_url: bool) -> List[str]:
        """Suggest appropriate MCP tools based on intent."""
        tools = []

        if intent == QueryIntent.FILE_ACCESS or has_file_path:
            tools.append("file_system")

        if intent == QueryIntent.API_CALL or has_url:
            tools.append("rest_api")

        if intent in [QueryIntent.EXTERNAL_DATA, QueryIntent.CURRENT_INFO, QueryIntent.HYBRID]:
            tools.append("web_search")

        # If no specific tools suggested, default to web search for external queries
        if not tools and intent != QueryIntent.INTERNAL_KNOWLEDGE:
            tools.append("web_search")

        return tools

class ToolRouter:
    """Routes queries to appropriate tools and coordinates execution."""

    def __init__(self):
        self.classifier = IntentClassifier()

    async def route_query(self, query: str, user_context: Dict[str, Any]) -> ToolExecutionPlan:
        """Route query and create execution plan."""

        # Analyze query intent
        analysis = self.classifier.analyze_query(query, user_context)
        logger.info(f"Query analysis: {analysis.intent.value} (confidence: {analysis.confidence:.2f})")

        # Check RAG relevance if needed
        rag_results = []
        if analysis.rag_needed:
            rag_results = await self._check_rag_relevance(query)

        # Determine execution strategy
        execution_plan = self._create_execution_plan(analysis, rag_results, user_context)

        return execution_plan

    async def _check_rag_relevance(self, query: str, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Check if RAG has relevant documents for the query."""
        try:
            results = search_documents(query, top_k=3)
            # Filter by relevance threshold
            relevant_results = [r for r in results if r.get('score', 0) >= threshold]
            return relevant_results
        except Exception as e:
            logger.error(f"Error checking RAG relevance: {e}")
            return []

    def _create_execution_plan(self, analysis: QueryAnalysis,
                              rag_results: List[Dict[str, Any]],
                              user_context: Dict[str, Any]) -> ToolExecutionPlan:
        """Create execution plan based on analysis and RAG results."""

        use_rag = analysis.rag_needed and len(rag_results) > 0
        use_mcp = len(analysis.suggested_tools) > 0

        # Determine execution strategy
        if analysis.intent == QueryIntent.INTERNAL_KNOWLEDGE:
            if use_rag:
                strategy = "rag_first" if use_mcp else "rag_only"
            else:
                strategy = "mcp_only" if use_mcp else "rag_only"

        elif analysis.intent == QueryIntent.EXTERNAL_DATA:
            strategy = "mcp_first" if use_rag else "mcp_only"

        elif analysis.intent == QueryIntent.HYBRID:
            strategy = "parallel" if analysis.confidence > 0.7 else "sequential"

        else:
            strategy = "parallel" if use_rag and use_mcp else ("rag_only" if use_rag else "mcp_only")

        # Set execution timeout based on tools
        max_time = 15.0  # Default
        if "web_search" in analysis.suggested_tools:
            max_time = max(max_time, 20.0)
        if "rest_api" in analysis.suggested_tools:
            max_time = max(max_time, 25.0)

        return ToolExecutionPlan(
            use_rag=use_rag,
            use_mcp=use_mcp,
            mcp_tools=analysis.suggested_tools,
            execution_strategy=strategy,
            max_execution_time=max_time
        )

class HybridExecutor:
    """Executes hybrid RAG + MCP queries according to execution plan."""

    def __init__(self):
        self.router = ToolRouter()

    async def execute_hybrid_query(self, query: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute query using optimal combination of RAG and MCP tools."""

        # Route query and get execution plan
        plan = await self.router.route_query(query, user_context)

        logger.info(f"Execution plan: RAG={plan.use_rag}, MCP={plan.use_mcp}, "
                   f"Strategy={plan.execution_strategy}, Tools={plan.mcp_tools}")

        # Execute according to strategy
        if plan.execution_strategy == "parallel":
            return await self._execute_parallel(query, plan, user_context)
        elif plan.execution_strategy == "sequential":
            return await self._execute_sequential(query, plan, user_context)
        elif plan.execution_strategy == "rag_first":
            return await self._execute_rag_first(query, plan, user_context)
        elif plan.execution_strategy == "mcp_first":
            return await self._execute_mcp_first(query, plan, user_context)
        elif plan.execution_strategy == "rag_only":
            return await self._execute_rag_only(query, plan, user_context)
        elif plan.execution_strategy == "mcp_only":
            return await self._execute_mcp_only(query, plan, user_context)
        else:
            # Fallback to parallel
            return await self._execute_parallel(query, plan, user_context)

    async def _execute_parallel(self, query: str, plan: ToolExecutionPlan,
                               user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute RAG and MCP tools in parallel."""
        tasks = []

        if plan.use_rag:
            tasks.append(self._execute_rag(query))

        if plan.use_mcp:
            tasks.append(self._execute_mcp_tools(query, plan, user_context))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results
        return self._combine_results(results, "parallel")

    async def _execute_sequential(self, query: str, plan: ToolExecutionPlan,
                                 user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute RAG first, then MCP tools with RAG context."""
        results = []

        if plan.use_rag:
            rag_result = await self._execute_rag(query)
            results.append(rag_result)

        if plan.use_mcp:
            # Use RAG results to enrich query context
            enriched_query = query
            if results and results[0].get('content'):
                enriched_query = f"{query}\n\nContext from internal docs: {results[0]['content'][:200]}..."

            mcp_result = await self._execute_mcp_tools(enriched_query, plan, user_context)
            results.append(mcp_result)

        return self._combine_results(results, "sequential")

    async def _execute_rag_first(self, query: str, plan: ToolExecutionPlan,
                                user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute RAG first, then MCP only if RAG results are insufficient."""
        rag_result = await self._execute_rag(query)

        # Check if RAG results are sufficient
        if self._are_rag_results_sufficient(rag_result):
            return rag_result

        # RAG insufficient, use MCP tools
        if plan.use_mcp:
            mcp_result = await self._execute_mcp_tools(query, plan, user_context)
            return self._combine_results([rag_result, mcp_result], "rag_first")

        return rag_result

    async def _execute_mcp_first(self, query: str, plan: ToolExecutionPlan,
                                user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP tools first, then RAG for additional context."""
        mcp_result = await self._execute_mcp_tools(query, plan, user_context)

        if plan.use_rag:
            rag_result = await self._execute_rag(query)
            return self._combine_results([mcp_result, rag_result], "mcp_first")

        return mcp_result

    async def _execute_rag_only(self, query: str, plan: ToolExecutionPlan,
                               user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute RAG search only."""
        return await self._execute_rag(query)

    async def _execute_mcp_only(self, query: str, plan: ToolExecutionPlan,
                               user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP tools only."""
        return await self._execute_mcp_tools(query, plan, user_context)

    async def _execute_rag(self, query: str) -> Dict[str, Any]:
        """Execute RAG search."""
        try:
            results = search_documents(query, top_k=3)

            if results:
                content = "## Internal Knowledge Base Results\n\n"
                for i, result in enumerate(results, 1):
                    content += f"**{i}. Document: {result['metadata'].get('filename', 'Unknown')}**\n"
                    content += f"Relevance: {result['score']:.2f}\n"
                    content += f"Content: {result['content'][:300]}...\n\n"

                return {
                    "source": "rag",
                    "content": content,
                    "metadata": {"result_count": len(results), "top_score": max(r['score'] for r in results)}
                }
            else:
                return {
                    "source": "rag",
                    "content": "No relevant documents found in internal knowledge base.",
                    "metadata": {"result_count": 0}
                }

        except Exception as e:
            logger.error(f"RAG execution error: {e}")
            return {
                "source": "rag",
                "content": f"Error searching internal documents: {str(e)}",
                "metadata": {"error": True}
            }

    async def _execute_mcp_tools(self, query: str, plan: ToolExecutionPlan,
                                user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute MCP tools."""
        try:
            execution_context = MCPExecutionContext(
                user_id=user_context.get('user_id', 0),
                user_role=user_context.get('role', 'user'),
                query=query,
                max_execution_time=plan.max_execution_time,
                parallel_execution=True
            )

            results = await mcp_manager.execute_tools(execution_context, plan.mcp_tools)

            # Format results
            content = "## External Data Sources\n\n"
            metadata = {"tools_used": [], "total_execution_time": 0}

            for result in results:
                metadata["tools_used"].append(result.tool_name)
                metadata["total_execution_time"] += result.execution_time

                content += f"**Source: {result.tool_name}**\n"
                content += f"Status: {result.status}\n"
                if result.error_message:
                    content += f"Error: {result.error_message}\n"
                else:
                    content += f"{result.content}\n"
                content += "\n"

            return {
                "source": "mcp",
                "content": content,
                "metadata": metadata
            }

        except Exception as e:
            logger.error(f"MCP execution error: {e}")
            return {
                "source": "mcp",
                "content": f"Error executing external tools: {str(e)}",
                "metadata": {"error": True}
            }

    def _are_rag_results_sufficient(self, rag_result: Dict[str, Any]) -> bool:
        """Check if RAG results are sufficient to answer the query."""
        metadata = rag_result.get('metadata', {})
        result_count = metadata.get('result_count', 0)
        top_score = metadata.get('top_score', 0)

        # Consider results sufficient if we have good matches
        return result_count > 0 and top_score > 0.8

    def _combine_results(self, results: List[Dict[str, Any]], strategy: str) -> Dict[str, Any]:
        """Combine results from multiple sources."""
        combined_content = ""
        combined_metadata = {
            "strategy": strategy,
            "sources": [],
            "total_results": 0
        }

        for result in results:
            if isinstance(result, Exception):
                combined_content += f"Error: {str(result)}\n\n"
                continue

            if result.get('content'):
                combined_content += result['content'] + "\n\n"

            combined_metadata["sources"].append(result.get('source', 'unknown'))
            if 'result_count' in result.get('metadata', {}):
                combined_metadata["total_results"] += result['metadata']['result_count']

        return {
            "source": "hybrid",
            "content": combined_content.strip(),
            "metadata": combined_metadata
        }

# Global instance
hybrid_executor = HybridExecutor()