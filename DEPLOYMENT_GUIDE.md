# Velocity LLM v2.1.0 Deployment Guide

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0+ (for Next.js frontend)
- **Python**: 3.11+ (for FastAPI backend)
- **Ollama**: Latest version (for AI model hosting)
- **Git**: For version control

### Development Tools
- **IDE**: VS Code recommended
- **Package Managers**: npm/yarn, pip
- **Database**: SQLite (included)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd perplexity_2.0
git checkout v2.1.0-stable
```

### 2. Backend Setup
```bash
cd server
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY="your-openai-key"
export SECRET_KEY="your-secret-key"
export ADMIN_TOKEN="your-admin-token"

# Start server
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```

### 4. Ollama Setup
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required model
ollama pull llama3.1:8b
```

## 🔧 Configuration

### Environment Variables (.env)
```env
# Backend (server/.env)
SECRET_KEY=your-secret-key-here
ADMIN_TOKEN=velocity_admin_12345
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=sqlite:///./velocity.db

# Frontend (client/.env.local)
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### Database Initialization
The SQLite database will be created automatically on first run.

### Admin User Creation
1. Start the application
2. Navigate to `/super-admin`
3. Use the admin token to create admin users
4. Create invite codes for additional admins

## 🗂️ File Structure Overview

```
perplexity_2.0/
├── client/                    # Next.js Frontend
│   ├── src/
│   │   ├── app/              # App router pages
│   │   │   ├── admin/        # Admin dashboard
│   │   │   ├── super-admin/  # Super admin panel
│   │   │   ├── layout.tsx    # Root layout
│   │   │   ├── page.tsx      # Main chat page
│   │   │   └── globals.css   # Global styles
│   │   └── components/       # React components
│   ├── package.json
│   └── next.config.js
├── server/                   # FastAPI Backend
│   ├── app.py               # Main application
│   ├── auth.py              # Authentication
│   ├── database.py          # Database models
│   ├── rag_utils.py         # RAG processing
│   └── requirements.txt
├── VERSION_HISTORY.md       # Version documentation
└── README.md               # Project overview
```

## 🔐 Authentication Flow

### User Types
1. **Regular Users**: Chat access only
2. **Admin**: Chat + document management
3. **Super Admin**: Full system access

### Login Process
1. Users register/login through main interface
2. Admins use `/admin` endpoint with credentials
3. Super admins use token-based authentication

## 📚 API Endpoints

### Public Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /chat` - Chat with AI

### Admin Endpoints
- `POST /admin/auth/login` - Admin login
- `POST /admin/upload` - Upload documents
- `GET /admin/documents` - List documents
- `DELETE /admin/documents/{filename}` - Delete document

### Super Admin Endpoints
- `POST /super-admin/auth/login` - Super admin login
- `GET /super-admin/users` - List all users
- `POST /super-admin/create-admin` - Create admin user

## 🎨 UI Components

### Sidebar Component
- **File**: `client/src/components/Sidebar.tsx`
- **Features**: Compact design, role-based links, user profile

### Chat History Flyout
- **File**: `client/src/components/ChatHistoryFlyout.tsx`
- **Features**: Search, date grouping, slide animation

### Input Bar
- **File**: `client/src/components/InputBar.tsx`
- **Features**: Message input, file uploads, send functionality

## 🛠️ Development Commands

### Frontend
```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # Code linting
```

### Backend
```bash
uvicorn app:app --reload              # Development
uvicorn app:app --host 0.0.0.0 --port 8000  # Production
python -m pytest                     # Tests (if available)
```

## 🚢 Production Deployment

### Docker (Recommended)
```dockerfile
# Create Dockerfile for containerized deployment
FROM node:18-alpine AS frontend
# ... frontend build steps

FROM python:3.11-slim AS backend
# ... backend setup steps
```

### Manual Deployment
1. Build frontend: `npm run build`
2. Configure reverse proxy (nginx)
3. Set up process manager (PM2/systemd)
4. Configure SSL certificates
5. Set production environment variables

## 🔍 Troubleshooting

### Common Issues
1. **Port conflicts**: Change ports in configuration
2. **Database permissions**: Ensure write access to SQLite file
3. **Ollama connection**: Verify Ollama is running and accessible
4. **CORS errors**: Check API URL configuration

### Logging
- Backend logs: Available in FastAPI console
- Frontend logs: Browser console and Next.js logs
- System logs: Check process manager logs

## 📝 Maintenance

### Regular Tasks
1. **Database backups**: Copy SQLite file regularly
2. **Log rotation**: Manage log file sizes
3. **Dependency updates**: Keep packages updated
4. **Security updates**: Monitor for vulnerabilities

### Monitoring
- Monitor API response times
- Track user engagement metrics
- Monitor system resource usage
- Set up health checks

## 🆘 Support

### Version Information
- **Current Version**: v2.1.0-stable
- **Git Tag**: v2.1.0-stable
- **Commit Hash**: 8a7b14b

### Getting Help
1. Check this deployment guide
2. Review VERSION_HISTORY.md
3. Check git commit history for changes
4. Review component documentation in source files

---

*This deployment guide covers the complete setup process for Velocity LLM v2.1.0. Keep this document updated with any configuration changes.*