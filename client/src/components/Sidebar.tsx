'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface SidebarProps {
  isAuthenticated: boolean;
  userData: any;
  onNewChat: () => void;
  onShowChatHistory: () => void;
  onShowAuth: () => void;
  onLogout: () => void;
  chatHistoryCount: number;
  viewMode: 'chat' | 'education';
  onToggleEducation: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isAuthenticated,
  userData,
  onNewChat,
  onShowChatHistory,
  onShowAuth,
  onLogout,
  chatHistoryCount,
  viewMode,
  onToggleEducation
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <div className="hidden md:flex fixed left-0 top-0 h-full w-20 bg-black flex-col z-40">
      {/* Logo Section */}
      <div className="flex items-center justify-center py-6">
        <img
          src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
          alt="Velocity Logo"
          className="w-8 h-8"
        />
      </div>

      {/* Navigation Section */}
      <div className="flex-1 px-2 space-y-1">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group"
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="text-xs font-medium text-center">New</span>
        </button>

        {/* Recent Chats Button */}
        {isAuthenticated && (
          <button
            onClick={onShowChatHistory}
            className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group relative"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            <span className="text-xs font-medium text-center">History</span>
            {chatHistoryCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#01953f] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {chatHistoryCount}
              </span>
            )}
          </button>
        )}

        {/* Discover */}
        <button className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group">
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <span className="text-xs font-medium text-center">Discover</span>
        </button>

        {/* Education Platform */}
        <button
          onClick={onToggleEducation}
          className={`w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg transition-colors group ${
            viewMode === 'education'
              ? 'bg-[#01953f] text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path>
          </svg>
          <span className="text-xs font-medium text-center">EduAI</span>
        </button>
      </div>

      {/* User Section */}
      <div className="p-2 border-t border-gray-700">
        {/* Admin Links */}
        {isAuthenticated && userData?.role && (userData.role === 'admin' || userData.role === 'super_admin') && (
          <div className="mb-2">
            {userData.role === 'super_admin' && (
              <Link
                href="/super-admin"
                className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group"
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                <span className="text-xs font-medium text-center">Super</span>
              </Link>
            )}
            {userData.role === 'admin' && (
              <Link
                href="/admin"
                className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors group"
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span className="text-xs font-medium text-center">Admin</span>
              </Link>
            )}
          </div>
        )}

        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 bg-[#01953f] text-white rounded-full flex items-center justify-center text-sm font-medium mb-1">
                {userData?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-center">Profile</span>
            </button>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute bottom-full left-20 mb-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-600 py-2 z-50">
                <div className="px-3 py-2 border-b border-gray-600">
                  <div className="text-xs font-medium text-white truncate">
                    {userData?.email || 'User'}
                  </div>
                  <div className="text-xs text-gray-400">Online</div>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            )}

            {/* Click outside to close dropdown */}
            {isProfileMenuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileMenuOpen(false)}
              />
            )}
          </div>
        ) : (
          <button
            onClick={onShowAuth}
            className="w-full flex flex-col items-center justify-center py-3 px-2 bg-[#01953f] hover:bg-[#01953f]/90 text-white rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span className="text-xs font-medium text-center">Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;