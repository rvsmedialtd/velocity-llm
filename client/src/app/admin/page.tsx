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

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    if (!confirm(`Delete ${filename}?`)) return;

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
      } else {
        setMessage(`Failed to delete ${filename}`);
      }
    } catch (error) {
      setMessage('Delete failed: Network error');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsAuthenticated(false);
    setUserData(null);
    setDocuments([]);
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

          {message && (
            <div className={`mt-4 p-3 rounded ${message.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}
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
                        {doc.total_chunks} chunks • {doc.file_type.toUpperCase()} file
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteDocument(doc.filename)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}