"use client"

import InputBar from '@/components/InputBar';
import MessageArea from '@/components/MessageArea';
import React, { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, searchInfo: finalSearchInfo, isLoading: false }
                      : msg
                  )
                );
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

        {/* New Chat Button */}
        <div className="p-6">
          <button
            onClick={() => {
              setMessages([]);
              setCheckpointId(null);
            }}
            className="w-full bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-3 px-4 rounded-lg transition-all duration-200 font-medium"
          >
            +
          </button>
        </div>

        {/* Chat History - Placeholder */}
        <div className="flex-1 px-6">
          <h3 className="text-gray-400 text-sm font-medium mb-4"></h3>
          <div className="space-y-2">
            {/* Placeholder for chat history */}
            <div className="text-gray-500 text-sm py-2 px-3 rounded hover:bg-gray-900 cursor-pointer">
            
            </div>
          </div>
        </div>

        {/* Admin Link */}
        <div className="p-6 border-t border-gray-800">
          <Link
            href="/admin"
            className="block w-full text-center text-gray-400 hover:text-white text-sm py-2 px-3 rounded hover:bg-gray-900 transition-colors"
          >
            🔧 Admin Panel
          </Link>
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
              <button
                className="md:hidden text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setMessages([]);
                  setCheckpointId(null);
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </button>
              <button className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
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
              </div>
            </div>
          ) : (
            <MessageArea messages={messages} />
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-200 bg-white">
          <InputBar currentMessage={currentMessage} setCurrentMessage={setCurrentMessage} onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
};

export default Home;