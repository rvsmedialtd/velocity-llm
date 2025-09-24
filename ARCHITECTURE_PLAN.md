# Velocity LLM v2.1.0 - Architecture Plan

## 🏗️ System Overview

Velocity LLM is a modern, Perplexity-inspired AI chat application with document processing capabilities, multi-role authentication, and real-time conversational AI. The system follows a microservices-inspired architecture with clear separation between frontend, backend, AI processing, and data storage layers.

## 📊 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 15.3.0 Frontend (React 19 + TypeScript + Tailwind)    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Chat UI   │ │ Admin Panel │ │ Super Admin │ │   Auth UI   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                 │
                           REST API (HTTP/HTTPS)
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│              FastAPI Backend (Python 3.11+)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Auth Service │ │Chat Service │ │ RAG Service │ │Admin Service││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                 │
                         Internal APIs
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                        AI/ML LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Ollama    │ │  ChromaDB   │ │ OpenAI API  │ │ LangChain   ││
│  │  (Local)    │ │ (Vector DB) │ │ (Optional)  │ │ (Pipeline)  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                 │
                         Data Persistence
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   SQLite    │ │  File Store │ │   Vector    │ │    Logs     ││
│  │ (Primary)   │ │ (Documents) │ │   Store     │ │  (System)   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 🏛️ Detailed Component Architecture

### 1. Frontend Layer (Client)

#### **Core Framework**
- **Next.js 15.3.0**: React-based full-stack framework
- **React 19**: Component-based UI library
- **TypeScript**: Type-safe JavaScript

#### **Component Structure**
```
src/
├── app/                    # App Router (Next.js 13+)
│   ├── layout.tsx         # Root layout component
│   ├── page.tsx           # Main chat interface
│   ├── globals.css        # Global styling
│   ├── admin/
│   │   └── page.tsx       # Admin dashboard
│   └── super-admin/
│       └── page.tsx       # Super admin panel
├── components/             # Reusable React components
│   ├── Sidebar.tsx        # Main navigation
│   ├── ChatHistoryFlyout.tsx  # Chat history panel
│   ├── ChatHistoryItem.tsx    # Individual chat item
│   ├── InputBar.tsx       # Message input interface
│   └── MessageArea.tsx    # Chat messages display
└── lib/                   # Utility functions and configs
```

#### **State Management**
- **React Hooks**: useState, useEffect for local state
- **Context API**: Authentication state management
- **Local Storage**: Token and user data persistence

#### **Styling System**
- **Tailwind CSS**: Utility-first CSS framework
- **Custom CSS**: Component-specific styles
- **Responsive Design**: Mobile-first approach

### 2. Backend Layer (Server)

#### **Core Framework**
- **FastAPI**: Modern Python web framework
- **Pydantic**: Data validation and serialization
- **Uvicorn**: ASGI server implementation

#### **Service Architecture**
```
server/
├── app.py              # Main FastAPI application
├── auth.py             # Authentication & authorization
├── database.py         # Database models & operations
├── rag_utils.py        # RAG processing utilities
├── requirements.txt    # Python dependencies
└── uploads/           # Document storage directory
```

#### **API Endpoints Structure**
```
Authentication Endpoints:
├── POST /auth/register     # User registration
├── POST /auth/login        # User login
├── POST /admin/auth/login  # Admin login
└── POST /super-admin/auth/login  # Super admin login

Chat Endpoints:
├── POST /chat             # Send message & get AI response
├── GET /conversations     # Get user's conversations
├── POST /conversations/rename  # Rename conversation
└── DELETE /conversations/{id}  # Delete conversation

Admin Endpoints:
├── POST /admin/upload     # Upload documents
├── GET /admin/documents   # List documents
└── DELETE /admin/documents/{filename}  # Delete documents

Super Admin Endpoints:
├── GET /super-admin/users    # List all users
├── GET /super-admin/admins   # List all admins
├── POST /super-admin/create-admin  # Create admin user
├── POST /super-admin/create-invite  # Create invite codes
└── GET /super-admin/invites  # List invite codes
```

### 3. AI/ML Layer

#### **Ollama Integration**
- **Purpose**: Local LLM hosting and inference
- **Models**: llama3.1:8b (primary), extensible to other models
- **Features**: Streaming responses, context management

#### **RAG (Retrieval-Augmented Generation)**
- **Document Processing**: PDF, DOCX, TXT support
- **Text Chunking**: RecursiveCharacterTextSplitter
- **Vector Storage**: ChromaDB for semantic search
- **Embeddings**: Local embedding models via Ollama

#### **LangChain Pipeline**
```python
Document → Text Extraction → Chunking → Embeddings → Vector Store
                                                          ↓
User Query → Embedding → Similarity Search → Context Retrieval
                                                          ↓
Context + Query → LLM (Ollama) → Generated Response
```

### 4. Data Layer

#### **Primary Database (SQLite)**
```sql
-- User Management
users (id, username, email, password_hash, role, created_at)
admins (id, username, email, password_hash, created_at)
admin_invites (id, code, email, created_by, used, created_at)

-- Chat System
chat_sessions (id, user_id, conversation_id, title, created_at, updated_at)
chat_messages (id, session_id, content, is_user, timestamp)

-- Document Management
documents (id, filename, file_type, upload_date, processed)
document_chunks (id, document_id, content, chunk_index, metadata)
```

#### **Vector Database (ChromaDB)**
- **Collections**: Document embeddings
- **Metadata**: File source, chunk index, timestamp
- **Similarity Search**: Cosine similarity for retrieval

## 🔐 Security Architecture

### Authentication Flow
```
1. User Registration/Login → JWT Token Generation
2. Token Storage → LocalStorage (Frontend)
3. API Requests → Bearer Token in Headers
4. Token Validation → Middleware verification
5. Role-based Access → Endpoint authorization
```

### Security Measures
- **Password Hashing**: bcrypt with salt
- **JWT Tokens**: Secure token-based authentication
- **Role-based Access Control**: User/Admin/Super-admin roles
- **Input Validation**: Pydantic models for API validation
- **CORS Protection**: Configured for specific origins
- **File Upload Security**: Type validation and size limits

## 📊 Data Flow Architecture

### Chat Flow
```
User Input → InputBar → API Call → FastAPI → RAG Search → Ollama LLM
                                                              ↓
Response Stream ← MessageArea ← WebSocket/SSE ← FastAPI ← Generated Text
```

### Document Processing Flow
```
File Upload → Admin Panel → FastAPI → Document Processor → Text Extraction
                                                              ↓
Vector Store ← Embeddings ← Text Chunking ← Processed Text
```

### Authentication Flow
```
Login Form → Credentials → FastAPI Auth → Database Validation → JWT Token
                                                                    ↓
LocalStorage ← Frontend ← API Response ← Token Generation
```

## 🚀 Performance Architecture

### Frontend Optimization
- **Code Splitting**: Next.js automatic code splitting
- **Server-Side Rendering**: Static generation where possible
- **Image Optimization**: Next.js Image component
- **Bundle Optimization**: Tree shaking and minification

### Backend Optimization
- **Async Processing**: FastAPI async/await patterns
- **Connection Pooling**: Database connection management
- **Caching Strategy**: In-memory caching for frequent queries
- **Rate Limiting**: API endpoint throttling

### AI/ML Optimization
- **Model Caching**: Ollama model persistence
- **Vector Indexing**: Efficient similarity search
- **Batch Processing**: Bulk document processing
- **Memory Management**: Optimized embedding storage

## 🔄 Scalability Considerations

### Horizontal Scaling
- **Load Balancing**: Multiple FastAPI instances
- **Database Sharding**: Partition by user or tenant
- **CDN Integration**: Static asset distribution
- **Microservices**: Service decomposition ready

### Vertical Scaling
- **Resource Optimization**: CPU and memory tuning
- **Database Indexing**: Query performance optimization
- **Caching Layers**: Redis integration ready
- **Background Jobs**: Celery task queue ready

## 🛠️ Development Architecture

### Development Environment
```
Local Development:
├── Frontend: npm run dev (Port 3000)
├── Backend: uvicorn app:app --reload (Port 8000)
├── AI Model: ollama serve (Port 11434)
└── Database: SQLite file-based
```

### Production Environment
```
Production Deployment:
├── Frontend: Next.js build + CDN
├── Backend: Uvicorn + Nginx reverse proxy
├── AI Model: Ollama dedicated server
└── Database: PostgreSQL/MySQL migration ready
```

### CI/CD Pipeline Ready
- **Version Control**: Git with feature branches
- **Testing**: Unit and integration test structure
- **Build Process**: Automated frontend/backend builds
- **Deployment**: Container-ready architecture

## 📈 Monitoring & Observability

### Logging Strategy
- **Application Logs**: FastAPI structured logging
- **Error Tracking**: Exception handling and reporting
- **Performance Metrics**: Response time monitoring
- **User Analytics**: Chat interaction tracking

### Health Checks
- **API Health**: Endpoint availability monitoring
- **Database Health**: Connection and query monitoring
- **AI Model Health**: Ollama service monitoring
- **System Resources**: CPU, memory, disk monitoring

## 🎯 Extension Points

### Future Enhancements
- **Multi-Model Support**: Easy model switching
- **Plugin Architecture**: Custom functionality modules
- **API Webhooks**: External service integrations
- **Advanced Analytics**: User behavior insights
- **Mobile Apps**: React Native ready
- **Enterprise Features**: SSO, audit logs, compliance

---

*This architecture plan provides a comprehensive overview of the Velocity LLM system design, enabling your development team to understand, maintain, and extend the application effectively.*