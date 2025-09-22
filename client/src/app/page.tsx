"use client"

import InputBar from '@/components/InputBar';
import MessageArea from '@/components/MessageArea';
import AuthModal from '@/components/AuthModal';
import Sidebar from '@/components/Sidebar';
import ChatHistoryFlyout from '@/components/ChatHistoryFlyout';
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
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);

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

  const deleteConversation = async (conversationId: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/user/chat/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setChatHistory(prev => prev.filter((chat: any) => chat.conversation_id !== conversationId));
        if (currentConversationId === conversationId) {
          setMessages([]);
          setCheckpointId(null);
          setCurrentConversationId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const renameConversation = async (conversationId: string, newTitle: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/user/chat/${conversationId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (response.ok) {
        setChatHistory(prev => prev.map((chat: any) =>
          chat.conversation_id === conversationId
            ? { ...chat, title: newTitle }
            : chat
        ));
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCheckpointId(null);
    setCurrentConversationId(null);
    setIsChatHistoryOpen(false);
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        isAuthenticated={isAuthenticated}
        userData={userData}
        onNewChat={handleNewChat}
        onShowChatHistory={() => setIsChatHistoryOpen(true)}
        onShowAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        chatHistoryCount={chatHistory.length}
      />

      {/* Chat History Flyout */}
      <ChatHistoryFlyout
        isOpen={isChatHistoryOpen}
        onClose={() => setIsChatHistoryOpen(false)}
        chatHistory={chatHistory}
        currentConversationId={currentConversationId}
        onLoadConversation={loadConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
      />

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
              alt="Velocity Logo"
              className="w-8 h-8"
            />
            <span className="text-xl font-bold text-[#01953f]">Velocity</span>
          </div>
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <button
                onClick={() => setIsChatHistoryOpen(true)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors relative"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                {chatHistory.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#01953f] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {chatHistory.length}
                  </span>
                )}
              </button>
            )}
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-2 bg-[#01953f] text-white rounded-lg text-sm font-medium"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-20 pt-16 md:pt-0">
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
        <div className="bg-white border-t border-gray-200">
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