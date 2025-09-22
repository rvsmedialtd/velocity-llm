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
from auth import (
    authenticate_user, authenticate_admin, get_current_user, get_current_admin,
    get_current_super_admin, verify_super_admin_token, create_access_token,
    get_password_hash, validate_username, validate_email, validate_password
)
from database import UserDB, AdminDB, ChatSessionDB, AdminInviteDB
from pydantic import BaseModel

load_dotenv()

# Pydantic models for request/response
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class ChatSaveRequest(BaseModel):
    conversation_id: str
    messages: List[Dict[str, Any]]
    title: Optional[str] = None

class AdminRegister(BaseModel):
    username: str
    email: str
    password: str
    invite_code: str

class InviteCreate(BaseModel):
    permissions: str = "upload,manage_docs"

# Authentication setup - keeping original for backward compatibility
security = HTTPBearer()
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "velocity_admin_12345")

def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin authentication token (legacy - now super admin)."""
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

# Simplified graph builder - temporarily revert to working version with RAG preparation
graph_builder = StateGraph(State)

graph_builder.add_node("model", model)
graph_builder.add_node("tool_node", tool_node)
graph_builder.set_entry_point("model")

graph_builder.add_conditional_edges("model", tools_router)
graph_builder.add_edge("tool_node", "model")

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

    # First, search documents for relevant content
    document_results = search_documents(message, top_k=3)
    document_context = None

    if document_results and any(result['score'] > 0.6 for result in document_results):
        # High relevance documents found - create context
        context_parts = []
        for result in document_results:
            if result['score'] > 0.6:  # Only include high-relevance results
                context_parts.append(f"[From {result['metadata']['filename']}]: {result['content']}")

        document_context = "\n\n".join(context_parts)

        # Send document search indication
        yield f"data: {{\"type\": \"document_search\", \"found\": {len(context_parts)}}}\n\n"

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

        # Enhanced system message with document context if available
        system_content = f"You are a helpful AI assistant. Today's date is {current_date}. When providing information, be aware of this current date and context."

        if document_context:
            system_content += f"\n\nIMPORTANT: Use the following document context to help answer the user's question. If the document context is relevant, reference it in your response and indicate that the information comes from uploaded documents:\n\n{document_context}\n\nIf you need additional current information beyond what's in the documents, you can use web search."

        system_message = SystemMessage(content=system_content)

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

        # For continuing conversations, add document context if available
        messages_to_send = [HumanMessage(content=message)]

        if document_context:
            # Insert document context before user message
            context_message = SystemMessage(content=f"Use the following document context to help answer the user's question:\n\n{document_context}")
            messages_to_send.insert(0, context_message)

        # Continue existing conversation
        events = graph.astream_events(
            {"messages": messages_to_send},
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

# User Authentication Endpoints
@app.post("/auth/register", response_model=TokenResponse)
async def register_user(user_data: UserRegister):
    """Register a new user."""
    # Validate input
    if not validate_username(user_data.username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    if not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not validate_password(user_data.password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Hash password
    password_hash = get_password_hash(user_data.password)

    # Create user
    user_id = UserDB.create_user(user_data.username, user_data.email, password_hash)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Create token
    token_data = {"sub": str(user_id), "username": user_data.username, "role": "user"}
    access_token = create_access_token(token_data)

    user_info = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "role": "user"
    }

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_info
    )

@app.post("/auth/login", response_model=TokenResponse)
async def login_user(user_data: UserLogin):
    """Login a user."""
    user = authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    # Create token
    token_data = {"sub": str(user["id"]), "username": user["username"], "role": "user"}
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@app.post("/admin/auth/login", response_model=TokenResponse)
async def login_admin(admin_data: AdminLogin):
    """Login an admin user."""
    admin = authenticate_admin(admin_data.username, admin_data.password)
    if not admin:
        raise HTTPException(
            status_code=401,
            detail="Incorrect admin username or password"
        )

    # Create token
    token_data = {"sub": str(admin["id"]), "username": admin["username"], "role": "admin"}
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=admin
    )

@app.get("/auth/me")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user information."""
    return current_user

# Chat History Endpoints
@app.post("/user/chat/save")
async def save_chat_session(
    chat_data: ChatSaveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Save a chat session for the current user."""
    session_id = ChatSessionDB.save_chat_session(
        current_user["id"],
        chat_data.conversation_id,
        chat_data.messages,
        chat_data.title
    )
    return {"success": True, "session_id": session_id}

@app.get("/user/chat/history")
async def get_chat_history(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get chat history for the current user."""
    sessions = ChatSessionDB.get_user_chat_sessions(current_user["id"])
    return {"sessions": sessions}

@app.get("/user/chat/{conversation_id}")
async def get_chat_session(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get a specific chat session."""
    session = ChatSessionDB.get_chat_session(current_user["id"], conversation_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session

@app.delete("/user/chat/{conversation_id}")
async def delete_chat_session(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a chat session."""
    success = ChatSessionDB.delete_chat_session(current_user["id"], conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"success": True}

# Admin-only document management endpoints (now requires admin role)
@app.post("/admin/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(verify_super_admin_token)
):
    """Upload and process a document (admin only)."""
    try:
        # Read file content
        content = await file.read()

        # Process the file
        result = process_uploaded_file(content, file.filename)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/admin/documents")
async def list_documents(current_user: Dict[str, Any] = Depends(verify_super_admin_token)):
    """List all uploaded documents (admin only)."""
    return {"documents": list_all_documents()}

@app.delete("/admin/documents/{filename}")
async def delete_document(
    filename: str,
    current_user: Dict[str, Any] = Depends(verify_super_admin_token)
):
    """Delete a document by filename (admin only)."""
    result = delete_document_by_filename(filename)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to delete document"))

# Super Admin Authentication
@app.post("/super-admin/auth/login", response_model=TokenResponse)
async def login_super_admin(admin_data: AdminLogin):
    """Super admin login endpoint."""
    SUPER_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "velocity_admin_12345")

    # Check if credentials match super admin token
    if admin_data.username == "super_admin" and admin_data.password == SUPER_ADMIN_TOKEN:
        # Create JWT token for super admin
        from auth import create_super_admin_token
        token = create_super_admin_token()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": 0,
                "username": "super_admin",
                "email": "admin@system.local",
                "role": "super_admin"
            }
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid super admin credentials")

# Super Admin Endpoints
@app.get("/super-admin/users")
async def get_all_users(current_user: Dict[str, Any] = Depends(verify_super_admin_token)):
    """Get all users for super admin dashboard."""
    users = UserDB.get_all_users()
    return {"users": users}

@app.get("/super-admin/admins")
async def get_all_admins(current_user: Dict[str, Any] = Depends(verify_super_admin_token)):
    """Get all admins for super admin dashboard."""
    admins = AdminDB.get_all_admins()
    return {"admins": admins}

@app.post("/super-admin/create-admin")
async def create_admin_user(
    admin_data: UserRegister,
    current_user: Dict[str, Any] = Depends(verify_super_admin_token)
):
    """Create a new admin user (super admin only)."""
    # Validate input
    if not validate_username(admin_data.username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    if not validate_email(admin_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not validate_password(admin_data.password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Hash password
    password_hash = get_password_hash(admin_data.password)

    # Create admin
    admin_id = AdminDB.create_admin(admin_data.username, admin_data.email, password_hash)
    if admin_id is None:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    return {"success": True, "admin_id": admin_id}

# Admin Invite Management Endpoints
@app.post("/super-admin/create-invite")
async def create_admin_invite(
    invite_data: InviteCreate,
    current_user: Dict[str, Any] = Depends(verify_super_admin_token)
):
    """Create a new admin invite code (super admin only)."""
    import secrets
    from datetime import datetime, timedelta

    # Generate unique invite code
    invite_code = secrets.token_urlsafe(32)

    # Set expiration to 24 hours from now
    expires_at = (datetime.now() + timedelta(hours=24)).isoformat()

    # Create invite (using user ID 0 for super admin)
    invite_id = AdminInviteDB.create_invite(
        invite_code=invite_code,
        permissions=invite_data.permissions,
        created_by=0,  # Super admin ID
        expires_at=expires_at
    )

    if invite_id is None:
        raise HTTPException(status_code=500, detail="Failed to create invite code")

    return {
        "success": True,
        "invite_code": invite_code,
        "expires_at": expires_at,
        "permissions": invite_data.permissions
    }

@app.get("/super-admin/invites")
async def get_admin_invites(current_user: Dict[str, Any] = Depends(verify_super_admin_token)):
    """Get all admin invite codes (super admin only)."""
    invites = AdminInviteDB.get_all_invites()
    return {"invites": invites}

@app.delete("/super-admin/invites/{invite_code}")
async def deactivate_invite(
    invite_code: str,
    current_user: Dict[str, Any] = Depends(verify_super_admin_token)
):
    """Deactivate an admin invite code (super admin only)."""
    success = AdminInviteDB.deactivate_invite(invite_code)

    if not success:
        raise HTTPException(status_code=404, detail="Invite code not found")

    return {"success": True, "message": "Invite code deactivated"}

@app.post("/admin/register", response_model=TokenResponse)
async def register_admin_with_invite(admin_data: AdminRegister):
    """Register as admin using invite code."""
    # Validate invite code
    invite = AdminInviteDB.validate_invite(admin_data.invite_code)
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invite code")

    # Validate input
    if not validate_username(admin_data.username):
        raise HTTPException(status_code=400, detail="Invalid username format")
    if not validate_email(admin_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not validate_password(admin_data.password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Hash password
    password_hash = get_password_hash(admin_data.password)

    # Create admin with permissions from invite
    admin_id = AdminDB.create_admin(
        username=admin_data.username,
        email=admin_data.email,
        password_hash=password_hash,
        permissions=invite['permissions']
    )

    if admin_id is None:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Mark invite as used
    AdminInviteDB.use_invite(admin_data.invite_code, admin_id)

    # Create access token
    token_data = {
        "sub": str(admin_id),
        "username": admin_data.username,
        "role": "admin"
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": admin_id,
            "username": admin_data.username,
            "email": admin_data.email,
            "role": "admin",
            "permissions": invite['permissions'].split(",") if invite['permissions'] else []
        }
    }

# SSE - server-sent events 