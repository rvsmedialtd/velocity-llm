"use client"

import InputBar from '@/components/InputBar';
import MessageArea from '@/components/MessageArea';
import AuthModal from '@/components/AuthModal';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
}

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo;
}

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [checkpointId, setCheckpointId] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const storedUserData = localStorage.getItem('userData');

    if (token && storedUserData) {
      setIsAuthenticated(true);
      setUserData(JSON.parse(storedUserData));
      fetchChatHistory(token);
    }
  }, []);

  const fetchChatHistory = async (token: string) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/user/chat/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const handleAuthSuccess = (token: string, userData: any) => {
    setIsAuthenticated(true);
    setUserData(userData);
    fetchChatHistory(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsAuthenticated(false);
    setUserData(null);
    setMessages([]);
    setCheckpointId(null);
    setChatHistory([]);
    setCurrentConversationId(null);
  };

  const loadConversation = async (conversationId: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/user/chat/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setCheckpointId(conversationId);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const saveConversation = async (conversationId: string, messages: Message[]) => {
    const token = localStorage.getItem('authToken');
    if (!token || !conversationId) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/user/chat/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: messages,
          title: messages.length > 0 ? messages[0].content.substring(0, 50) + '...' : 'New Chat'
        })
      });

      if (response.ok) {
        fetchChatHistory(token);
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    if (currentMessage.trim()) {
      // First add the user message to the chat
      const newMessageId = messages.length > 0 ? Math.max(...messages.map(msg => msg.id)) + 1 : 1;

      setMessages(prev => [
        ...prev,
        {
          id: newMessageId,
          content: currentMessage,
          isUser: true,
          type: 'message'
        }
      ]);

      const userInput = currentMessage;
      setCurrentMessage(""); // Clear input field immediately

      try {
        // Create AI response placeholder
        const aiResponseId = newMessageId + 1;
        setMessages(prev => [
          ...prev,
          {
            id: aiResponseId,
            content: "",
            isUser: false,
            type: 'message',
            isLoading: true,
            searchInfo: {
              stages: [],
              query: "",
              urls: []
            }
          }
        ]);

        // Create URL with checkpoint ID if it exists
        let url = `http://127.0.0.1:8000/chat_stream/${encodeURIComponent(userInput)}`;
        if (checkpointId) {
          url += `?checkpoint_id=${encodeURIComponent(checkpointId)}`;
        }

        // Connect to SSE endpoint using EventSource
        const eventSource = new EventSource(url);
        let streamedContent = "";
        let searchData: SearchInfo | null = null;
        let hasReceivedContent = false;

        // Process incoming messages
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'checkpoint') {
              // Store the checkpoint ID for future requests
              setCheckpointId(data.checkpoint_id);
            }
            else if (data.type === 'content') {
              streamedContent += data.content;
              hasReceivedContent = true;

              // Update message with accumulated content
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, isLoading: false }
                    : msg
                )
              );
            }
            else if (data.type === 'search_start') {
              // Create search info with 'searching' stage
              const newSearchInfo = {
                stages: ['searching'],
                query: data.query,
                urls: []
              };
              searchData = newSearchInfo;

              // Update the AI message with search info
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                    : msg
                )
              );
            }
            else if (data.type === 'search_results') {
              try {
                // Parse URLs from search results
                const urls = typeof data.urls === 'string' ? JSON.parse(data.urls) : data.urls;

                // Update search info to add 'reading' stage (don't replace 'searching')
                const newSearchInfo = {
                  stages: searchData ? [...searchData.stages, 'reading'] : ['reading'],
                  query: searchData?.query || "",
                  urls: urls
                };
                searchData = newSearchInfo;

                // Update the AI message with search info
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                      : msg
                  )
                );
              } catch (err) {
                console.error("Error parsing search results:", err);
              }
            }
            else if (data.type === 'search_error') {
              // Handle search error
              const newSearchInfo = {
                stages: searchData ? [...searchData.stages, 'error'] : ['error'],
                query: searchData?.query || "",
                error: data.error,
                urls: []
              };
              searchData = newSearchInfo;

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: false }
                    : msg
                )
              );
            }
            else if (data.type === 'end') {
              // When stream ends, add 'writing' stage if we had search info
              if (searchData) {
                const finalSearchInfo = {
                  ...searchData,
                  stages: [...searchData.stages, 'writing']
                };

                setMessages(prev => {
                  const updatedMessages = prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, searchInfo: finalSearchInfo, isLoading: false }
                      : msg
                  );

                  // Save conversation after updating messages
                  if (checkpointId && updatedMessages.length > 0) {
                    setTimeout(() => saveConversation(checkpointId, updatedMessages), 500);
                  }

                  return updatedMessages;
                });
              } else {
                // Save conversation even without search info
                setMessages(prev => {
                  if (checkpointId && prev.length > 0) {
                    setTimeout(() => saveConversation(checkpointId, prev), 500);
                  }
                  return prev;
                });
              }

              eventSource.close();
            }
          } catch (error) {
            console.error("Error parsing event data:", error, event.data);
          }
        };

        // Handle errors
        eventSource.onerror = (error) => {
          console.error("EventSource error:", error);
          eventSource.close();

          // Only update with error if we don't have content yet
          if (!streamedContent) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiResponseId
                  ? { ...msg, content: "Sorry, there was an error processing your request.", isLoading: false }
                  : msg
              )
            );
          }
        };

        // Listen for end event
        eventSource.addEventListener('end', () => {
          eventSource.close();
        });
      } catch (error) {
        console.error("Error setting up EventSource:", error);
        setMessages(prev => [
          ...prev,
          {
            id: newMessageId + 1,
            content: "Sorry, there was an error connecting to the server.",
            isUser: false,
            type: 'message',
            isLoading: false
          }
        ]);
      }
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-80 bg-black border-r border-gray-800 flex flex-col hidden md:flex">
        {/* Logo and Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <img
              src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
              alt="Velocity Logo"
              className="w-8 h-8"
            />
            
          </div>
          <p className="text-gray-400 text-sm mt-2"></p>
        </div>

        {/* Auth/User Section */}
        <div className="p-6">
          {isAuthenticated ? (
            <div>
             {/*<div className="text-white text-sm mb-4">
                Welcome, {userData?.username}
              </div>*/}
              <button
                onClick={() => {
                  setMessages([]);
                  setCheckpointId(null);
                  setCurrentConversationId(null);
                }}
                className="w-full hover:text-black text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium mb-3"
              >
                <img src="https://velocity.idevelopment.site/uploads/add_3_540b2a0136.png"></img>
              </button>
              {/*<button
                onClick={handleLogout}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-all duration-200 font-medium text-sm"
              >
                Logout
              </button>*/}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full hover:text-black text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium"
            >
             <img src="https://velocity.idevelopment.site/uploads/add_3_540b2a0136.png"></img>
            </button>
          )}
        </div>

        {/* Chat History */}
        <div className="flex-1 px-6">
          {isAuthenticated && chatHistory.length > 0 && (
            <>
              
              <img class="saved" width="100px" src="https://velocity.idevelopment.site/uploads/save_instagram_3_5063ae7622.png"/>
              <h3 className="admin-text">Saved</h3>
              <div className="space-y-2">
                {chatHistory.map((chat: any) => (
                  <div
                    key={chat.conversation_id}
                    onClick={() => loadConversation(chat.conversation_id)}
                    className={`text-gray-500 text-sm py-2 px-3 rounded hover:bg-gray-900 cursor-pointer transition-colors ${
                      currentConversationId === chat.conversation_id ? 'bg-gray-800 text-white' : ''
                    }`}
                  >
                    <div className="truncate">
                      {chat.title || 'Untitled Chat'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(chat.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Admin Link */}
        <div className="p-6 border-t border-gray-800">
          {isAuthenticated && userData?.role === 'super_admin' ? (
            <Link
              href="/super-admin"
              className="block w-full text-center text-gray-400 hover:text-white text-sm py-2 px-3 rounded hover:bg-gray-900 transition-colors"
            >
            <img class="saved"
        src="https://velocity.idevelopment.site/uploads/dashboard_1_54ab21237e.png"
        alt="Dashboard"></img><span class="admin-text">Admin</span>
            </Link>
          ) : (
            <Link
              href="/admin"
              className="block w-full bg-img text-center text-gray-400 hover:text-white text-sm py-2 px-3 rounded hover:bg-gray-900 transition-colors"
            >
              👩🏼‍💼 Admin Dashboard
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="text-gray-400 text-xs">
            Powered by Velocity AI
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile logo for small screens */}
            <div className="flex items-center space-x-3 md:hidden">
              <img
                src="https://velocity.idevelopment.site/uploads/velocity_w_2300faad13.svg"
                alt="Velocity Logo"
                className="w-6 h-6"
              />
              <h1 className="text-xl font-bold text-[#01953f]">Velocity</h1>
            </div>

            {/* Desktop title */}
            <h2 className="text-lg font-semibold text-gray-800 hidden md:block">Search</h2>

            <div className="flex items-center space-x-4">
              {/* Mobile new chat button */}
              {isAuthenticated && (
                <button
                  className="md:hidden text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setMessages([]);
                    setCheckpointId(null);
                    setCurrentConversationId(null);
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                </button>
              )}

              {/* Mobile auth button */}
              {!isAuthenticated && (
                <button
                  className="md:hidden text-gray-500 hover:text-gray-700"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </button>
              )}

              {/* Settings button */}
              <button className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>

              {/* Desktop user info / logout */}
              {isAuthenticated && (
                <div className="hidden md:flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Welcome, {userData?.username} | </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            // Welcome Screen
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="text-center max-w-2xl">
                <div className="mb-8">
                  <img
                    src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
                    alt="Velocity Logo"
                    className="w-16 h-16 mx-auto mb-4 opacity-80"
                  />
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Velocity</h2>
                  <p className="text-gray-600 text-lg">Ask me anything and I'll search the web to give you accurate, up-to-date answers.</p>
                </div>

                {isAuthenticated ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="bg-gray-50 p-4 rounded-lg border hover:border-[#01953f] transition-colors cursor-pointer"
                         onClick={() => setCurrentMessage("What's the latest news in AI?")}>
                      <div className="text-[#01953f] mb-2">🤖</div>
                      <h3 className="font-medium text-gray-800 mb-1">Latest AI News</h3>
                      <p className="text-gray-600 text-sm">Get the most recent developments in artificial intelligence</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border hover:border-[#01953f] transition-colors cursor-pointer"
                         onClick={() => setCurrentMessage("Explain quantum computing")}>
                      <div className="text-[#01953f] mb-2">⚛️</div>
                      <h3 className="font-medium text-gray-800 mb-1">Explain Complex Topics</h3>
                      <p className="text-gray-600 text-sm">Break down complex subjects into understandable explanations</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border hover:border-[#01953f] transition-colors cursor-pointer"
                         onClick={() => setCurrentMessage("Best restaurants in New York")}>
                      <div className="text-[#01953f] mb-2">🍽️</div>
                      <h3 className="font-medium text-gray-800 mb-1">Local Recommendations</h3>
                      <p className="text-gray-600 text-sm">Find the best places to eat, visit, or explore</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border hover:border-[#01953f] transition-colors cursor-pointer"
                         onClick={() => setCurrentMessage("How to learn Python programming?")}>
                      <div className="text-[#01953f] mb-2">💻</div>
                      <h3 className="font-medium text-gray-800 mb-1">Learning Resources</h3>
                      <p className="text-gray-600 text-sm">Get guidance on learning new skills and topics</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-500 mb-4">Please sign in to start chatting</p>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-3 px-6 rounded-lg transition-all duration-200 font-medium"
                    >
                      Sign In to Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <MessageArea messages={messages} />
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-200 bg-white">
          <InputBar
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSubmit={handleSubmit}
            placeholder={isAuthenticated ? "Ask me anything..." : "Sign in to start chatting"}
            disabled={!isAuthenticated}
          />
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default Home;