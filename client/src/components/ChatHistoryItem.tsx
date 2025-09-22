'use client';

import React, { useState } from 'react';

interface ChatHistoryItemProps {
  chat: {
    id?: string;
    conversation_id: string;
    title: string;
    updated_at: string;
    created_at: string;
    messages?: any[];
  };
  isActive: boolean;
  onClick: () => void;
  onDelete?: (conversationId: string) => void;
  onRename?: (conversationId: string, newTitle: string) => void;
}

const ChatHistoryItem: React.FC<ChatHistoryItemProps> = ({
  chat,
  isActive,
  onClick,
  onDelete,
  onRename
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 3600);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getPreviewText = () => {
    if (chat.messages && chat.messages.length > 0) {
      const firstUserMessage = chat.messages.find(msg => msg.isUser);
      if (firstUserMessage) {
        return firstUserMessage.content.substring(0, 60) + (firstUserMessage.content.length > 60 ? '...' : '');
      }
    }
    return chat.title.substring(0, 60) + (chat.title.length > 60 ? '...' : '');
  };

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== chat.title) {
      onRename?.(chat.conversation_id, newTitle.trim());
    }
    setIsRenaming(false);
    setIsMenuOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewTitle(chat.title);
      setIsRenaming(false);
    }
  };

  return (
    <div className={`group relative bg-white rounded-lg border transition-all duration-200 hover:shadow-md ${
      isActive
        ? 'border-[#01953f] shadow-sm bg-green-50'
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div
        className="p-4 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyPress}
                className="w-full text-sm font-medium text-gray-900 bg-transparent border-b border-[#01953f] focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3 className={`text-sm font-medium mb-1 truncate ${
                isActive ? 'text-[#01953f]' : 'text-gray-900'
              }`}>
                {chat.title || 'Untitled Chat'}
              </h3>
            )}

            <p className="text-xs text-gray-500 mb-2 line-clamp-2">
              {getPreviewText()}
            </p>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                {formatDate(chat.updated_at)}
              </span>

              {/* Chat type indicator */}
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <span className="text-xs text-gray-400">
                  {chat.messages?.length || 0} messages
                </span>
              </div>
            </div>
          </div>

          {/* Menu button */}
          <div className="relative ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 transition-all ${
                isMenuOpen ? 'opacity-100' : ''
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01"></path>
              </svg>
            </button>

            {/* Dropdown menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRenaming(true);
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                    <span>Rename</span>
                  </div>
                </button>

                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chat.conversation_id);
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      <span>Delete</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#01953f] rounded-l-lg"></div>
      )}

      {/* Click outside to close menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatHistoryItem;