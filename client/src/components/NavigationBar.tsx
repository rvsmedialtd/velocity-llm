'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface NavigationBarProps {
  isAuthenticated: boolean;
  userData: any;
  onNewChat: () => void;
  onShowChatHistory: () => void;
  onShowAuth: () => void;
  onLogout: () => void;
  chatHistoryCount: number;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  isAuthenticated,
  userData,
  onNewChat,
  onShowChatHistory,
  onShowAuth,
  onLogout,
  chatHistoryCount
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 relative z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Section - Logo and Navigation */}
        <div className="flex items-center space-x-6">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="https://velocity.idevelopment.site/uploads/shape_27_1_1d90ad6dd8.svg"
              alt="Velocity Logo"
              className="w-8 h-8"
            />
            <span className="text-xl font-bold text-[#01953f] hidden sm:block">Velocity</span>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-1">
            {/* Home/Search */}
            <button
              onClick={onNewChat}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <span className="font-medium">Search</span>
            </button>

            {/* Recent Chats - Trigger for flyout */}
            {isAuthenticated && chatHistoryCount > 0 && (
              <button
                onClick={onShowChatHistory}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors group"
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                  {chatHistoryCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#01953f] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {chatHistoryCount > 9 ? '9+' : chatHistoryCount}
                    </span>
                  )}
                </div>
                <span className="font-medium">Recent</span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
            )}

            {/* Discover */}
            <button className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10l2 16H5L7 4z"></path>
              </svg>
              <span className="font-medium">Discover</span>
            </button>
          </div>
        </div>

        {/* Center Section - Search indicator for mobile */}
        <div className="md:hidden">
          <button
            onClick={onNewChat}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </button>
        </div>

        {/* Right Section - User Actions */}
        <div className="flex items-center space-x-3">
          {/* New Chat Button */}
          {isAuthenticated && (
            <button
              onClick={onNewChat}
              className="hidden sm:flex items-center space-x-2 bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span>New Chat</span>
            </button>
          )}

          {/* Mobile New Chat */}
          {isAuthenticated && (
            <button
              onClick={onNewChat}
              className="sm:hidden flex items-center justify-center w-10 h-10 bg-[#01953f] hover:bg-[#01fb6a] text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
            </button>
          )}

          {/* Mobile Chat History Button */}
          {isAuthenticated && chatHistoryCount > 0 && (
            <button
              onClick={onShowChatHistory}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              {chatHistoryCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#01953f] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {chatHistoryCount > 9 ? '9+' : chatHistoryCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile / Auth */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <div className="w-8 h-8 bg-[#01953f] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {userData?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <svg className="w-4 h-4 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{userData?.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{userData?.role || 'User'}</p>
                  </div>

                  {userData?.role === 'super_admin' && (
                    <Link
                      href="/super-admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                        </svg>
                        <span>Super Admin</span>
                      </div>
                    </Link>
                  )}

                  {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                        <span>Admin Dashboard</span>
                      </div>
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                      </svg>
                      <span>Logout</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onShowAuth}
              className="bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Click outside to close profile menu */}
      {isProfileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsProfileMenuOpen(false)}
        />
      )}
    </nav>
  );
};

export default NavigationBar;