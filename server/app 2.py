from typing import TypedDict, Annotated, Optional, List, Dict, Any
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage, SystemMessage
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
from uuid import uuid4
from langgraph.checkpoint.memory import MemorySaver
from datetime import datetime
import os
from rag_utils import process_uploaded_file, search_documents, delete_document_by_filename, list_all_documents

load_dotenv()

# Authentication setup
security = HTTPBearer()
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "velocity_admin_12345")

def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin authentication token."""
    if credentials.credentials != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return credentials

# Initialize memory saver for checkpointing
memory = MemorySaver()

class State(TypedDict):
    messages: Annotated[list, add_messages]
    document_context: Optional[str]
    search_strategy: str  # "documents", "web", "hybrid"
    source_attribution: List[Dict[str, Any]]

search_tool = TavilySearchResults(
    max_results=4,
)

tools = [search_tool]

llm = ChatOpenAI(model="gpt-4o")

llm_with_tools = llm.bind_tools(tools=tools)

async def model(state: State):
    result = await llm_with_tools.ainvoke(state["messages"])
    return {
        "messages": [result], 
    }

async def tools_router(state: State):
    last_message = state["messages"][-1]

    if(hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0):
        return "tool_node"
    else: 
        return END
    
async def tool_node(state):
    """Custom tool node that handles tool calls from the LLM."""
    # Get the tool calls from the last message
    tool_calls = state["messages"][-1].tool_calls
    
    # Initialize list to store tool messages
    tool_messages = []
    
    # Process each tool call
    for tool_call in tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]
        
        # Handle the search tool
        if tool_name == "tavily_search_results_json":
            # Execute the search tool with the provided arguments
            search_results = await search_tool.ainvoke(tool_args)
            
            # Create a ToolMessage for this result
            tool_message = ToolMessage(
                content=str(search_results),
                tool_call_id=tool_id,
                name=tool_name
            )
            
            tool_messages.append(tool_message)
    
    # Add the tool messages to the state
    return {"messages": tool_messages}

async def query_classifier(state: State):
    """Determine search strategy based on query content."""
    last_message = state["messages"][-1]
    query = last_message.content if hasattr(last_message, 'content') else str(last_message)

    # Search for relevant documents
    document_results = search_documents(query, top_k=3)

    # Determine strategy based on document availability and query intent
    if document_results and any(result['score'] > 0.7 for result in document_results):
        # High relevance documents found
        if "explain further" in query.lower() or "more details" in query.lower() or "latest" in query.lower():
            strategy = "hybrid"  # Use both documents and web search
        else:
            strategy = "documents"  # Documents only
    else:
        strategy = "web"  # Web search only

    return {
        "search_strategy": strategy,
        "document_context": None,
        "source_attribution": []
    }

async def document_retrieval(state: State):
    """Retrieve relevant documents from vector database."""
    last_message = state["messages"][-1]
    query = last_message.content if hasattr(last_message, 'content') else str(last_message)

    # Search documents
    document_results = search_documents(query, top_k=3)

    if document_results:
        # Combine document content
        context_parts = []
        source_attribution = []

        for result in document_results:
            context_parts.append(f"[From {result['metadata']['filename']}]: {result['content']}")
            source_attribution.append({
                "type": "document",
                "filename": result['metadata']['filename'],
                "score": result['score']
            })

        document_context = "\n\n".join(context_parts)

        return {
            "document_context": document_context,
            "source_attribution": source_attribution
        }

    return {
        "document_context": None,
        "source_attribution": []
    }

async def enhanced_model(state: State):
    """Enhanced model that incorporates document context."""
    messages = state["messages"].copy()

    # Add document context to system message if available
    if state.get("document_context"):
        context_message = SystemMessage(
            content=f"Use the following document context to help answer the user's question. If the document context is relevant, reference it in your response and indicate that the information comes from uploaded documents.\n\nDocument Context:\n{state['document_context']}\n\nIf you need additional current information beyond what's in the documents, you can use web search."
        )
        messages.insert(-1, context_message)  # Insert before the last user message

    # Invoke the LLM
    result = await llm_with_tools.ainvoke(messages)

    return {
        "messages": [result]
    }

async def enhanced_tools_router(state: State):
    """Enhanced router that considers search strategy."""
    last_message = state["messages"][-1]

    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
        return "tool_node"
    else:
        return END

# Enhanced graph builder with RAG capabilities
graph_builder = StateGraph(State)

# Add all nodes
graph_builder.add_node("query_classifier", query_classifier)
graph_builder.add_node("document_retrieval", document_retrieval)
graph_builder.add_node("enhanced_model", enhanced_model)
graph_builder.add_node("tool_node", tool_node)

# Set entry point
graph_builder.set_entry_point("query_classifier")

# Define workflow edges
graph_builder.add_edge("query_classifier", "document_retrieval")
graph_builder.add_edge("document_retrieval", "enhanced_model")
graph_builder.add_conditional_edges("enhanced_model", enhanced_tools_router)
graph_builder.add_edge("tool_node", "enhanced_model")

graph = graph_builder.compile(checkpointer=memory)

app = FastAPI()

# Add CORS middleware with settings that match frontend requirements
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"], 
    expose_headers=["Content-Type"], 
)

def serialise_ai_message_chunk(chunk): 
    if(isinstance(chunk, AIMessageChunk)):
        return chunk.content
    else:
        raise TypeError(
            f"Object of type {type(chunk).__name__} is not correctly formatted for serialisation"
        )

async def generate_chat_responses(message: str, checkpoint_id: Optional[str] = None):
    is_new_conversation = checkpoint_id is None
    
    if is_new_conversation:
        # Generate new checkpoint ID for first message in conversation
        new_checkpoint_id = str(uuid4())

        config = {
            "configurable": {
                "thread_id": new_checkpoint_id
            }
        }
        
        # Get current date for system context
        current_date = datetime.now().strftime("%B %d, %Y")

        # Initialize with system message containing current date and user message
        system_message = SystemMessage(content=f"You are a helpful AI assistant. Today's date is {current_date}. When providing information, be aware of this current date and context.")

        events = graph.astream_events(
            {"messages": [system_message, HumanMessage(content=message)]},
            version="v2",
            config=config
        )
        
        # First send the checkpoint ID
        yield f"data: {{\"type\": \"checkpoint\", \"checkpoint_id\": \"{new_checkpoint_id}\"}}\n\n"
    else:
        config = {
            "configurable": {
                "thread_id": checkpoint_id
            }
        }
        # Continue existing conversation
        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config
        )

    async for event in events:
        event_type = event["event"]
        
        if event_type == "on_chat_model_stream":
            chunk_content = serialise_ai_message_chunk(event["data"]["chunk"])
            # Escape single quotes and newlines for safe JSON parsing
            safe_content = chunk_content.replace("'", "\\'").replace("\n", "\\n")
            
            yield f"data: {{\"type\": \"content\", \"content\": \"{safe_content}\"}}\n\n"
            
        elif event_type == "on_chat_model_end":
            # Check if there are tool calls for search
            tool_calls = event["data"]["output"].tool_calls if hasattr(event["data"]["output"], "tool_calls") else []
            search_calls = [call for call in tool_calls if call["name"] == "tavily_search_results_json"]
            
            if search_calls:
                # Signal that a search is starting
                search_query = search_calls[0]["args"].get("query", "")
                # Escape quotes and special characters
                safe_query = search_query.replace('"', '\\"').replace("'", "\\'").replace("\n", "\\n")
                yield f"data: {{\"type\": \"search_start\", \"query\": \"{safe_query}\"}}\n\n"
                
        elif event_type == "on_tool_end" and event["name"] == "tavily_search_results_json":
            # Search completed - send results or error
            output = event["data"]["output"]
            
            # Check if output is a list 
            if isinstance(output, list):
                # Extract URLs from list of search results
                urls = []
                for item in output:
                    if isinstance(item, dict) and "url" in item:
                        urls.append(item["url"])
                
                # Convert URLs to JSON and yield them
                urls_json = json.dumps(urls)
                yield f"data: {{\"type\": \"search_results\", \"urls\": {urls_json}}}\n\n"
    
    # Send an end event
    yield f"data: {{\"type\": \"end\"}}\n\n"

@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None)):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id), 
        media_type="text/event-stream"
    )

# SSE - server-sent events 