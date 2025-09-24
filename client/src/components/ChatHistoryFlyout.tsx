'use client';

import React, { useState, useEffect, useRef } from 'react';
import ChatHistoryItem from './ChatHistoryItem';

interface ChatSession {
  id?: string;
  conversation_id: string;
  title: string;
  updated_at: string;
  created_at: string;
  messages?: any[];
}

interface ChatHistoryFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  chatHistory: ChatSession[];
  currentConversationId: string | null;
  onLoadConversation: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onRenameConversation?: (conversationId: string, newTitle: string) => void;
}

interface GroupedChats {
  today: ChatSession[];
  yesterday: ChatSession[];
  lastWeek: ChatSession[];
  older: ChatSession[];
}

const ChatHistoryFlyout: React.FC<ChatHistoryFlyoutProps> = ({
  isOpen,
  onClose,
  chatHistory,
  currentConversationId,
  onLoadConversation,
  onDeleteConversation,
  onRenameConversation
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState<ChatSession[]>(chatHistory);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Group chats by date
  const groupChatsByDate = (chats: ChatSession[]): GroupedChats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return chats.reduce((groups: GroupedChats, chat) => {
      const chatDate = new Date(chat.updated_at);
      const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

      if (chatDateOnly.getTime() === today.getTime()) {
        groups.today.push(chat);
      } else if (chatDateOnly.getTime() === yesterday.getTime()) {
        groups.yesterday.push(chat);
      } else if (chatDate >= lastWeek) {
        groups.lastWeek.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    }, { today: [], yesterday: [], lastWeek: [], older: [] });
  };

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chatHistory);
    } else {
      const filtered = chatHistory.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (chat.messages && chat.messages.some(msg =>
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chatHistory]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const groupedChats = groupChatsByDate(filteredChats);

  const ChatGroup: React.FC<{ title: string; chats: ChatSession[]; icon: string }> = ({ title, chats, icon }) => {
    if (chats.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-3 px-1">
          <span className="text-lg">{icon}</span>
          <h3 className="text-sm font-semibold text-theme-secondary uppercase tracking-wider">
            {title} ({chats.length})
          </h3>
        </div>
        <div className="space-y-2">
          {chats.map((chat) => (
            <ChatHistoryItem
              key={chat.conversation_id}
              chat={chat}
              isActive={currentConversationId === chat.conversation_id}
              onClick={() => {
                onLoadConversation(chat.conversation_id);
                onClose();
              }}
              onDelete={onDeleteConversation}
              onRename={onRenameConversation}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm transition-opacity duration-300 z-50 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Flyout Panel */}
      <div
        ref={flyoutRef}
        className={`fixed top-0 left-0 h-full bg-theme-primary shadow-2xl transition-transform duration-300 ease-out z-60 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl`}
      >
        {/* Header */}
        <div className="bg-theme-primary border-b border-theme-primary px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-theme-primary">Recent Chats</h2>
              <span className="bg-theme-tertiary text-theme-secondary text-xs px-2 py-1 rounded-full">
                {filteredChats.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-theme-secondary rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-theme-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-theme-primary rounded-lg focus:ring-2 focus:ring-[#01953f] focus:border-[#01953f] transition-colors bg-theme-secondary text-theme-primary placeholder:text-theme-tertiary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-4 w-4 text-theme-tertiary hover:text-theme-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {filteredChats.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-theme-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <h3 className="text-lg font-medium text-theme-primary mb-1">No results found</h3>
                  <p className="text-theme-tertiary">Try searching with different keywords</p>
                </div>
              ) : (
                <div>
                  <svg className="mx-auto h-12 w-12 text-theme-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                  <h3 className="text-lg font-medium text-theme-primary mb-1">No conversations yet</h3>
                  <p className="text-theme-tertiary">Start a new chat to see your conversation history</p>
                </div>
              )}
            </div>
          ) : searchQuery ? (
            // Show flat list when searching
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <ChatHistoryItem
                  key={chat.conversation_id}
                  chat={chat}
                  isActive={currentConversationId === chat.conversation_id}
                  onClick={() => {
                    onLoadConversation(chat.conversation_id);
                    onClose();
                  }}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                />
              ))}
            </div>
          ) : (
            // Show grouped chats when not searching
            <div>
              <ChatGroup title="Today" chats={groupedChats.today} icon="🕐" />
              <ChatGroup title="Yesterday" chats={groupedChats.yesterday} icon="📅" />
              <ChatGroup title="Last 7 days" chats={groupedChats.lastWeek} icon="📆" />
              <ChatGroup title="Older" chats={groupedChats.older} icon="🗂️" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-theme-primary p-4 flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-theme-tertiary">
            <span>{filteredChats.length} conversation{filteredChats.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onClose}
              className="text-[#01953f] hover:text-[#01953f]/80 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatHistoryFlyout;