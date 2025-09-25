# Velocity LLM Project - Claude Context Guide

## Quick Start Summary
**Project**: Perplexity-style chat application with RAG capabilities
**Location**: `/Users/rvsmedia/Documents/GPT/velocity-llm/perplexity_2.0/`
**Status**: Stable, production-ready (v2.1.0-stable)
**Last Updated**: September 24, 2025

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15.3.0, React 19, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python 3.11+, SQLite database
- **AI/ML**: Ollama integration, ChromaDB vector store
- **Authentication**: JWT tokens, bcrypt password hashing

### Directory Structure
```
perplexity_2.0/
├── client/                    # Next.js frontend (port 3000)
│   ├── src/app/
│   │   ├── admin/            # Admin dashboard
│   │   ├── super-admin/      # Super admin dashboard
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Main chat interface
│   │   └── globals.css       # Global styles
│   └── src/components/
│       ├── Sidebar.tsx              # Main navigation
│       ├── ChatHistoryFlyout.tsx    # Chat history panel
│       ├── InputBar.tsx             # Message input
│       └── MessageArea.tsx          # Chat display
└── server/                   # FastAPI backend (port 8000)
    ├── app.py               # Main API server
    ├── auth.py              # Authentication logic
    ├── database.py          # Database models
    ├── rag_utils.py         # RAG processing
    ├── mcp_tools.py         # MCP tool implementations
    └── users.db             # SQLite database
```

## Authentication System

### User Types & Login Endpoints
1. **Regular Users**
   - Endpoint: `POST /auth/login`
   - Database table: `users`
   - Features: Chat, document search

2. **Admin Users**
   - Endpoint: `POST /admin/auth/login`
   - Database table: `admins`
   - Features: Document upload, user management

3. **Super Admin Users**
   - Endpoint: `POST /super-admin/auth/login`
   - Database table: `admins` (with elevated permissions)
   - Features: Full system administration

### Current Test Users
- **Admin**: sakshi / admin1234 (full_admin permissions, email: sakshi@rvsmedia.com)

## Database Schema

### Key Tables
- `users` - Regular user accounts
- `admins` - Admin user accounts
- `chat_sessions` - Conversation history
- `documents` - Uploaded files for RAG processing
- `mcp_tools` - MCP tool configurations
- `mcp_connections` - Active MCP connections

### Quick DB Commands
```bash
# Check users
sqlite3 users.db "SELECT username, email FROM users;"
sqlite3 users.db "SELECT username, email FROM admins;"

# View schema
sqlite3 users.db ".schema"
```

## Development Commands

### Starting Services
```bash
# Backend (from server/)
uvicorn app:app --reload --host 127.0.0.1 --port 8000

# Frontend (from client/)
npm run dev
```

### Common Troubleshooting
```bash
# Kill conflicting processes
pkill -f "uvicorn app:app"
pkill -f "npm run dev"

# Clear Python cache (fixes import errors)
rm -rf __pycache__

# Check running processes
ps aux | grep -E "(uvicorn|npm)"
```

## API Endpoints Reference

### Authentication
- `POST /auth/login` - Regular user login
- `POST /admin/auth/login` - Admin user login
- `POST /super-admin/auth/login` - Super admin login

### Chat & Documents
- `GET /chat_stream/{query}` - Streaming chat responses
- `POST /upload_document` - Upload documents for RAG
- `GET /user/chat/history` - Get chat history
- `GET /documents` - List uploaded documents

## Known Issues & Solutions

### 1. Login "Network Error"
**Problem**: Getting "Network error. Please try again" when logging in
**Solution**:
- Check if user exists in correct table (`users` vs `admins`)
- Use appropriate login endpoint (`/auth/login` vs `/admin/auth/login`)
- Verify server is running on port 8000

### 2. Server Import Errors
**Problem**: `ImportError: cannot import name 'X' from 'Y'`
**Solution**: Clear Python cache: `rm -rf __pycache__`

### 3. Port Conflicts
**Problem**: "Address already in use" errors
**Solution**: Kill existing processes before starting new ones

### 4. BCrypt Version Warnings
**Problem**: BCrypt version compatibility warnings
**Status**: Known issue, doesn't affect functionality

## MCP (Model Context Protocol) Integration

### Available Tools
- `web_search` - Tavily web search integration
- `file_system` - Local file access (currently disabled)
- `rest_api` - Generic REST API connector

### Configuration
MCP tools are configured via the database and can be managed through the admin interface.

## Features

### Core Features
1. **Multi-role Authentication** - User, Admin, Super-admin roles
2. **Document Management** - Upload, process, and search documents
3. **Chat History** - Persistent conversation history with search
4. **Real-time Chat** - Streaming responses with typing indicators
5. **RAG System** - Document processing with ChromaDB vector store
6. **Modern UI** - Perplexity-inspired design with responsive layout

### Admin Features
- Document upload and management
- User management
- System configuration
- MCP tool management

## Recent Changes Log

### September 24, 2025
- **Fixed**: Server import errors by clearing Python cache
- **Fixed**: Login issues for admin user "sakshi"
- **Reverted**: MCP file system implementation (per user request)
- **Confirmed**: All core functionality working correctly

## Environment Setup

### Required Environment Variables
Check `.env` file in server directory for:
- Database configuration
- JWT secrets
- API keys (Tavily, OpenAI, etc.)

### Python Dependencies
See `server/requirements.txt` for full list including:
- fastapi
- uvicorn
- sqlalchemy
- chromadb
- langchain
- bcrypt

### Node Dependencies
See `client/package.json` for frontend dependencies.

## Testing

### Quick Health Checks
```bash
# Test server
curl http://127.0.0.1:8000/

# Test admin login
curl -X POST "http://127.0.0.1:8000/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"sakshi","password":"admin1234"}'

# Check frontend
curl http://127.0.0.1:3000/
```

## Production Notes

### Current Status
- **Version**: v2.1.0-stable
- **Branch**: main
- **Stability**: Production-ready
- **Performance**: Optimized for real-time chat

### Deployment
- Frontend builds to `.next/` directory
- Backend runs with uvicorn ASGI server
- Database is file-based SQLite (users.db)
- Document storage in `uploads/` directory

## Tips for Future Development

1. **Always read this file first** when returning to the project
2. **Update this file** when making significant changes
3. **Test login endpoints** before assuming auth issues
4. **Clear Python cache** if seeing import errors
5. **Check both users and admins tables** when debugging login issues

---

*Last updated: September 24, 2025 by Claude Code Assistant*
*Project maintained at: `/Users/rvsmedia/Documents/GPT/velocity-llm/perplexity_2.0/`*