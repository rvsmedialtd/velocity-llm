'use client';

import { useState, useEffect } from 'react';

interface Document {
  filename: string;
  file_type: string;
  total_chunks: number;
  document_ids: string[];
}

interface UploadResponse {
  success: boolean;
  filename?: string;
  chunks_created?: number;
  error?: string;
}

interface MCPTool {
  id: number;
  name: string;
  tool_type: string;
  description: string;
  is_enabled: boolean;
}

interface MCPConnection {
  id: number;
  tool_id: number;
  name: string;
  endpoint: string;
  status: string;
  created_at: string;
  tool_name: string;
  tool_type: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('documents');

  // Documents state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewingFile, setViewingFile] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // MCP state
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    tool_id: '',
    name: '',
    endpoint: '',
    config: '{}',
    credentials: '{}'
  });

  // General state
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Check authentication on load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    const storedUserData = localStorage.getItem('userData');

    if (!token || !storedUserData) {
      setLoading(false);
      return;
    }

    try {
      const userData = JSON.parse(storedUserData);

      // Check if user is admin
      if (userData.role !== 'admin') {
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setUserData(userData);
      await loadDocuments(token);
      await loadMCPData(token);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (token: string) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/admin/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadMCPData = async (token: string) => {
    try {
      // Load available MCP tools
      const toolsResponse = await fetch('http://127.0.0.1:8000/admin/mcp/tools', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (toolsResponse.ok) {
        const toolsData = await toolsResponse.json();
        setMcpTools(toolsData.tools || []);
      }

      // Load admin's MCP connections
      const connectionsResponse = await fetch('http://127.0.0.1:8000/admin/mcp/connections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        setMcpConnections(connectionsData.connections || []);
      }
    } catch (error) {
      console.error('Failed to load MCP data:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch('http://127.0.0.1:8000/admin/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result: UploadResponse = await response.json();

      if (result.success) {
        setMessage(`Successfully uploaded ${result.filename} (${result.chunks_created} chunks created)`);
        await loadDocuments(token!);
      } else {
        setMessage(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setMessage('Upload failed: Network error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const deleteDocument = async (filename: string) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://127.0.0.1:8000/admin/documents/${filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setMessage(`Successfully deleted ${filename}`);
        await loadDocuments(token!);
        setDeleteConfirm(null);
      } else {
        const error = await response.json();
        setMessage(`Failed to delete ${filename}: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage('Delete failed: Network error');
    }
  };

  const viewDocument = async (filename: string) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://127.0.0.1:8000/admin/documents/${filename}/view`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setViewingFile(result);
      } else {
        const error = await response.json();
        setMessage(`Failed to view ${filename}: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage('View failed: Network error');
    }
  };

  const downloadDocument = async (filename: string) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://127.0.0.1:8000/admin/documents/${filename}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage(`Downloaded ${filename}`);
      } else {
        const error = await response.json();
        setMessage(`Failed to download ${filename}: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage('Download failed: Network error');
    }
  };

  const createMCPConnection = async () => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch('http://127.0.0.1:8000/admin/mcp/connections', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool_id: parseInt(connectionForm.tool_id),
          name: connectionForm.name,
          endpoint: connectionForm.endpoint,
          config: JSON.parse(connectionForm.config),
          credentials: JSON.parse(connectionForm.credentials)
        })
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`Successfully created connection: ${connectionForm.name}`);
        setShowConnectionForm(false);
        setConnectionForm({
          tool_id: '',
          name: '',
          endpoint: '',
          config: '{}',
          credentials: '{}'
        });
        await loadMCPData(token!);
      } else {
        const error = await response.json();
        setMessage(`Failed to create connection: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage('Create connection failed: Network error');
    }
  };

  const deleteMCPConnection = async (connectionId: number) => {
    const token = localStorage.getItem('authToken');
    try {
      const response = await fetch(`http://127.0.0.1:8000/admin/mcp/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setMessage('Connection deleted successfully');
        await loadMCPData(token!);
      } else {
        const error = await response.json();
        setMessage(`Failed to delete connection: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage('Delete connection failed: Network error');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsAuthenticated(false);
    setUserData(null);
    setDocuments([]);
    setMcpTools([]);
    setMcpConnections([]);
    setMessage('Logged out');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#01953f] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Admin access required. Please log in as an admin user.</p>
          <a
            href="/"
            className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-2 px-4 rounded-lg transition-all duration-200 font-medium"
          >
            Go to Home & Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img
                src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
                alt="Velocity Logo"
                className="w-8 h-8"
              />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {userData?.username}</span>
              <a
                href="/"
                className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-2 px-4 rounded-lg transition-all duration-200 font-medium text-sm mr-2"
              >
                Back to Chat
              </a>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('documents')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documents'
                    ? 'border-[#01953f] text-[#01953f]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Document Management
              </button>
              <button
                onClick={() => setActiveTab('mcp')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'mcp'
                    ? 'border-[#01953f] text-[#01953f]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                MCP Connections
              </button>
            </nav>
          </div>
        </div>

        {/* Documents Tab Content */}
        {activeTab === 'documents' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {uploading ? (
              <div className="text-gray-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Uploading...
              </div>
            ) : (
              <div>
                <div className="text-gray-600 mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-2">
                  Drag and drop files here, or{' '}
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                    browse
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF, DOCX, and TXT files
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Uploaded Documents ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No documents uploaded yet</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 text-sm font-medium">
                          {doc.file_type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                      <p className="text-sm text-gray-500">
                        {doc.chunks_count || doc.total_chunks || 0} chunks • {doc.file_type.toUpperCase()} file
                      </p>
                      {doc.upload_date && (
                        <p className="text-xs text-gray-400">
                          Uploaded: {new Date(doc.upload_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => viewDocument(doc.filename)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => downloadDocument(doc.filename)}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      title="Download document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(doc.filename)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          </>
        )}

        {/* MCP Tab Content */}
        {activeTab === 'mcp' && (
          <>
            {/* MCP Connections Header */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">MCP Connections</h2>
                <button
                  onClick={() => setShowConnectionForm(true)}
                  className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-2 px-4 rounded-lg transition-all duration-200 font-medium text-sm"
                >
                  Add Connection
                </button>
              </div>

              {/* Connections List */}
              {mcpConnections.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No MCP connections configured yet</p>
              ) : (
                <div className="space-y-3">
                  {mcpConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            connection.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            <span className={`text-xs font-medium ${
                              connection.status === 'active' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {connection.status === 'active' ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{connection.name}</p>
                          <p className="text-sm text-gray-500">
                            {connection.tool_name} ({connection.tool_type})
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(connection.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          connection.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {connection.status}
                        </span>
                        <button
                          onClick={() => deleteMCPConnection(connection.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete connection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Tools */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available MCP Tools</h3>
              {mcpTools.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No MCP tools available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mcpTools.map((tool) => (
                    <div key={tool.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{tool.name}</h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          tool.is_enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {tool.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{tool.description}</p>
                      <p className="text-xs text-gray-500">Type: {tool.tool_type}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Message Display */}
        {message && (
          <div className={`mt-4 p-3 rounded ${message.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDocument(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCP Connection Form Modal */}
      {showConnectionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create MCP Connection</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tool</label>
                <select
                  value={connectionForm.tool_id}
                  onChange={(e) => setConnectionForm({...connectionForm, tool_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                >
                  <option value="">Select a tool</option>
                  {mcpTools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name} ({tool.tool_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection Name</label>
                <input
                  type="text"
                  value={connectionForm.name}
                  onChange={(e) => setConnectionForm({...connectionForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                  placeholder="My Connection"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint (Optional)</label>
                <input
                  type="text"
                  value={connectionForm.endpoint}
                  onChange={(e) => setConnectionForm({...connectionForm, endpoint: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                  placeholder="https://api.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Configuration (JSON)</label>
                <textarea
                  value={connectionForm.config}
                  onChange={(e) => setConnectionForm({...connectionForm, config: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f] h-20 font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credentials (JSON)</label>
                <textarea
                  value={connectionForm.credentials}
                  onChange={(e) => setConnectionForm({...connectionForm, credentials: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f] h-20 font-mono text-sm"
                  placeholder='{"api_key": "your-key"}'
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowConnectionForm(false);
                  setConnectionForm({
                    tool_id: '',
                    name: '',
                    endpoint: '',
                    config: '{}',
                    credentials: '{}'
                  });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createMCPConnection}
                disabled={!connectionForm.tool_id || !connectionForm.name}
                className="px-4 py-2 bg-[#01953f] text-white rounded-lg hover:bg-[#01fb6a] hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 h-3/4 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Viewing: {viewingFile.metadata?.filename}
              </h3>
              <button
                onClick={() => setViewingFile(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {viewingFile.file_type === 'pdf' ? (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">PDF Preview</p>
                  <p className="text-sm text-gray-500">
                    File size: {Math.round((viewingFile.metadata?.file_size || 0) / 1024)} KB
                  </p>
                  <p className="text-sm text-gray-500">
                    Chunks: {viewingFile.metadata?.chunks_count || 0}
                  </p>
                  <button
                    onClick={() => downloadDocument(viewingFile.metadata?.filename)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Download to View
                  </button>
                </div>
              ) : (
                <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                  {viewingFile.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}