# Velocity LLM v2.1.0 - Development Team Handoff Document

## 🚀 Project Overview

**Velocity LLM** is a production-ready AI chat application inspired by Perplexity, featuring document processing, multi-role authentication, and a modern React-based interface. This document provides everything your development team needs to understand, maintain, and extend the application.

## 📋 Quick Start Checklist

### **Immediate Setup** (30 minutes)
- [ ] Clone repository: `git checkout v2.1.0-stable`
- [ ] Install dependencies: `npm install` (client) + `pip install -r requirements.txt` (server)
- [ ] Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
- [ ] Pull AI model: `ollama pull llama3.1:8b`
- [ ] Start development servers (see commands below)
- [ ] Verify application loads at http://localhost:3000

### **Development Commands**
```bash
# Terminal 1: Frontend
cd client && npm run dev

# Terminal 2: Backend
cd server && uvicorn app:app --reload

# Terminal 3: AI Model (if not running)
ollama serve
```

## 🏗️ System Architecture Summary

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   Next.js UI    │ ←→ API Calls →  │   FastAPI       │
│   (Port 3000)   │                 │   (Port 8000)   │
└─────────────────┘                 └─────────────────┘
                                              │
                                    ┌─────────────────┐
                                    │     Ollama      │
                                    │   (Port 11434)  │
                                    └─────────────────┘
                                              │
                                    ┌─────────────────┐
                                    │  SQLite + RAG   │
                                    │   (Data Layer)  │
                                    └─────────────────┘
```

## 🎯 Key Features Implemented

### **✅ Core Features**
- [x] **Real-time AI Chat**: Streaming responses with Ollama integration
- [x] **Document RAG System**: Upload PDFs/DOCX, search through content
- [x] **Multi-role Authentication**: User/Admin/Super-admin with JWT
- [x] **Modern UI**: Perplexity-inspired design with Tailwind CSS
- [x] **Chat History**: Persistent conversations with search and grouping
- [x] **Admin Dashboard**: Document management interface
- [x] **Responsive Design**: Mobile and desktop optimized

### **✅ Technical Features**
- [x] **Type Safety**: Full TypeScript implementation
- [x] **API Documentation**: Automatic Swagger docs at `/docs`
- [x] **Security**: bcrypt passwords, JWT tokens, role-based access
- [x] **Performance**: Async backend, code splitting, optimized builds
- [x] **Developer Experience**: Hot reloading, ESLint, Prettier

## 🛠️ Technology Stack

### **Frontend Stack**
| Technology | Purpose | Version |
|------------|---------|---------|
| Next.js | React Framework | 15.3.0 |
| React | UI Library | 19.0 |
| TypeScript | Type Safety | Latest |
| Tailwind CSS | Styling | Latest |

### **Backend Stack**
| Technology | Purpose | Version |
|------------|---------|---------|
| FastAPI | Web Framework | Latest |
| Python | Language | 3.11+ |
| SQLite | Database | 3.x |
| JWT | Authentication | Latest |

### **AI/ML Stack**
| Technology | Purpose | Version |
|------------|---------|---------|
| Ollama | Local LLM | Latest |
| ChromaDB | Vector Database | Latest |
| LangChain | RAG Pipeline | Latest |
| Llama 3.1 8B | AI Model | Latest |

## 📁 Project Structure

```
velocity-llm/
├── client/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── page.tsx      # Main chat interface
│   │   │   ├── admin/        # Admin dashboard
│   │   │   └── super-admin/  # Super admin panel
│   │   └── components/       # React components
│   │       ├── Sidebar.tsx           # Main navigation
│   │       ├── ChatHistoryFlyout.tsx # Chat history panel
│   │       ├── InputBar.tsx          # Message input
│   │       └── MessageArea.tsx       # Chat display
│   ├── package.json          # Dependencies
│   └── tailwind.config.js    # Styling config
├── server/                   # FastAPI Backend
│   ├── app.py               # Main API application
│   ├── auth.py              # Authentication logic
│   ├── database.py          # Database models
│   ├── rag_utils.py         # Document processing
│   └── requirements.txt     # Python dependencies
├── ARCHITECTURE_PLAN.md     # Detailed architecture
├── TECHNICAL_STACK.md       # Technology documentation
├── DEPLOYMENT_GUIDE.md      # Setup instructions
└── VERSION_HISTORY.md       # Release notes
```

## 🔐 Authentication System

### **User Roles**
1. **Regular Users**: Chat access only
2. **Admin**: Chat + document management
3. **Super Admin**: Full system access + user management

### **Authentication Flow**
```
Login → JWT Token → LocalStorage → API Headers → Role Verification
```

### **API Endpoints by Role**
```
Public: /auth/register, /auth/login, /chat
Admin: /admin/*, /admin/upload, /admin/documents
Super Admin: /super-admin/*, /super-admin/users
```

## 🎨 UI Components Guide

### **Main Components**

#### **Sidebar.tsx**
- **Purpose**: Main navigation with user profile
- **Features**: Compact design, role-based links, profile dropdown
- **Key Props**: `isAuthenticated`, `userData`, `onNewChat`, `onShowChatHistory`

#### **ChatHistoryFlyout.tsx**
- **Purpose**: Sliding chat history panel
- **Features**: Search, date grouping, rename/delete conversations
- **Key Props**: `isOpen`, `chatHistory`, `onLoadConversation`

#### **InputBar.tsx**
- **Purpose**: Message input interface
- **Features**: Send messages, file uploads, responsive design
- **Key Props**: `currentMessage`, `setCurrentMessage`, `onSendMessage`

#### **MessageArea.tsx**
- **Purpose**: Chat message display
- **Features**: Streaming responses, message formatting, scrolling
- **Key Props**: `messages`, `isLoading`, `conversationId`

### **Styling Conventions**
- **Colors**: Primary green `#01953f`, gray scale for UI
- **Spacing**: Tailwind spacing scale (4, 6, 8, 12)
- **Responsive**: Mobile-first design with md: breakpoints
- **Icons**: SVG icons for performance and customization

## 🔧 Development Workflow

### **Feature Development Process**
1. **Branch**: Create feature branch from `main`
2. **Develop**: Make changes with type safety
3. **Test**: Verify frontend and backend functionality
4. **Commit**: Use descriptive commit messages
5. **Review**: Code review before merging
6. **Deploy**: Merge to main triggers deployment

### **Common Development Tasks**

#### **Adding New API Endpoint**
```python
# In server/app.py
@app.post("/new-endpoint")
async def new_endpoint(
    data: YourModel,
    current_user: Dict = Depends(get_current_user)
):
    # Implementation
    return {"result": "success"}
```

#### **Adding New React Component**
```typescript
// In client/src/components/NewComponent.tsx
interface NewComponentProps {
  title: string;
  onAction: () => void;
}

const NewComponent: React.FC<NewComponentProps> = ({ title, onAction }) => {
  return (
    <div className="bg-white p-4 rounded-lg">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button onClick={onAction} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
        Action
      </button>
    </div>
  );
};

export default NewComponent;
```

#### **Adding New Database Model**
```python
# In server/database.py
class NewModel:
    def __init__(self):
        # Model implementation
        pass

    @staticmethod
    def create_table():
        # Table creation SQL
        pass
```

## 🚨 Common Issues & Solutions

### **Development Issues**

#### **Port Conflicts**
```bash
# If ports are in use, change them:
# Frontend: package.json scripts
# Backend: uvicorn command port flag
# Ollama: OLLAMA_HOST environment variable
```

#### **CORS Errors**
```python
# In server/app.py, update CORS origins:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### **Database Issues**
```bash
# Delete SQLite file to reset:
rm server/velocity.db

# Restart server to recreate tables
```

### **AI/ML Issues**

#### **Ollama Connection**
```bash
# Check if Ollama is running:
ollama list

# Pull model if missing:
ollama pull llama3.1:8b

# Check Ollama logs:
ollama logs
```

#### **Document Processing**
```bash
# Check upload directory permissions:
ls -la server/uploads/

# Clear vector database:
rm -rf server/chroma_db/
```

## 📊 Performance Optimization

### **Frontend Optimizations**
- **Code Splitting**: Automatic with Next.js
- **Image Optimization**: Use Next.js Image component
- **Bundle Analysis**: `npm run build` shows bundle sizes
- **Lazy Loading**: Implement for heavy components

### **Backend Optimizations**
- **Database Indexing**: Add indexes for frequent queries
- **Caching**: Implement Redis for session storage
- **Connection Pooling**: Configure for production database
- **Async Operations**: Use async/await for I/O operations

### **AI/ML Optimizations**
- **Model Caching**: Ollama keeps models in memory
- **Batch Processing**: Process multiple documents together
- **Vector Indexing**: Optimize ChromaDB for large datasets
- **Context Management**: Limit context size for better performance

## 🔒 Security Considerations

### **Current Security Measures**
- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Role-based access control
- ✅ Input validation with Pydantic
- ✅ File upload type validation
- ✅ CORS protection

### **Security Best Practices**
- 🔄 Regular dependency updates
- 🔄 Environment variable management
- 🔄 API rate limiting implementation
- 🔄 HTTPS enforcement in production
- 🔄 Security headers configuration

## 🚀 Deployment & Production

### **Environment Variables**
```bash
# Backend (.env)
SECRET_KEY=your-secret-key
ADMIN_TOKEN=your-admin-token
OPENAI_API_KEY=optional-openai-key
DATABASE_URL=sqlite:///./velocity.db

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### **Production Deployment**
1. **Build Frontend**: `npm run build`
2. **Configure Nginx**: Reverse proxy setup
3. **SSL Certificate**: Let's Encrypt or commercial
4. **Process Management**: PM2 or systemd
5. **Database Migration**: SQLite → PostgreSQL for scale
6. **Monitoring**: Set up logging and health checks

## 📞 Support & Resources

### **Documentation Files**
- `ARCHITECTURE_PLAN.md`: Detailed system architecture
- `TECHNICAL_STACK.md`: Complete technology overview
- `DEPLOYMENT_GUIDE.md`: Step-by-step deployment
- `VERSION_HISTORY.md`: Feature history and changes

### **Quick Reference**
- **API Documentation**: http://localhost:8000/docs
- **Git Tag**: `v2.1.0-stable`
- **Backup Location**: `../perplexity_2.0_v2.1.0-stable_backup.tar.gz`

### **Team Contacts**
- **Architecture Questions**: Refer to ARCHITECTURE_PLAN.md
- **Technical Issues**: Check TECHNICAL_STACK.md
- **Deployment Help**: Use DEPLOYMENT_GUIDE.md

---

## 🎯 Next Steps for Development Team

### **Week 1: Familiarization**
- [ ] Set up local development environment
- [ ] Run through user flows (registration, chat, admin)
- [ ] Review code structure and conventions
- [ ] Identify areas for improvement

### **Week 2: Enhancement Planning**
- [ ] Performance optimization opportunities
- [ ] New feature prioritization
- [ ] Security audit and improvements
- [ ] Testing strategy implementation

### **Week 3+: Active Development**
- [ ] Implement prioritized features
- [ ] Set up CI/CD pipeline
- [ ] Production deployment planning
- [ ] Monitoring and analytics setup

---

*This handoff document provides your development team with everything needed to successfully maintain and extend the Velocity LLM application. For detailed technical information, refer to the accompanying documentation files.*