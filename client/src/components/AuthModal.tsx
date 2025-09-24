"use client"

import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (token: string, userData: any) => void;
}

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  inviteCode?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isAdminRegister, setIsAdminRegister] = useState(false);

  const [loginData, setLoginData] = useState<LoginData>({
    username: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState<RegisterData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Choose endpoint based on login type
      const endpoint = isSuperAdmin
        ? 'http://127.0.0.1:8001/super-admin/auth/login'
        : isAdminLogin
          ? 'http://127.0.0.1:8001/admin/auth/login'
          : 'http://127.0.0.1:8001/auth/login';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        onAuthSuccess(data.access_token, data.user);
        onClose();
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    if (isAdminRegister && !registerData.inviteCode) {
      setError('Invite code is required for admin registration');
      setIsLoading(false);
      return;
    }

    try {
      // Choose endpoint based on admin registration
      const endpoint = isAdminRegister
        ? 'http://127.0.0.1:8001/admin/register'
        : 'http://127.0.0.1:8001/auth/register';

      const requestBody = isAdminRegister
        ? {
            username: registerData.username,
            email: registerData.email,
            password: registerData.password,
            invite_code: registerData.inviteCode
          }
        : {
            username: registerData.username,
            email: registerData.email,
            password: registerData.password
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        onAuthSuccess(data.access_token, data.user);
        onClose();
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setLoginData({ username: '', password: '' });
    setRegisterData({ username: '', email: '', password: '', confirmPassword: '', inviteCode: '' });
    setError('');
    setIsSuperAdmin(false);
    setIsAdminLogin(false);
    setIsAdminRegister(false);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white2 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white3 rounded-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {isLogin
              ? 'Sign In'
              : isAdminRegister
                ? 'Admin Registration'
                : 'Create Account'
            }
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="adminLogin"
                  checked={isAdminLogin}
                  onChange={(e) => {
                    setIsAdminLogin(e.target.checked);
                    if (e.target.checked) setIsSuperAdmin(false);
                  }}
                  className="h-4 w-4 text-[#01953f] focus:ring-[#01953f] border-gray-300 rounded"
                />
                <label htmlFor="adminLogin" className="ml-2 block text-sm text-gray-700">
                  Admin Login
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="superAdmin"
                  checked={isSuperAdmin}
                  onChange={(e) => {
                    setIsSuperAdmin(e.target.checked);
                    if (e.target.checked) setIsAdminLogin(false);
                  }}
                  className="h-4 w-4 text-[#01953f] focus:ring-[#01953f] border-gray-300 rounded"
                />
                <label htmlFor="superAdmin" className="ml-2 block text-sm text-gray-700">
                  Super Admin Login
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-2 px-4 rounded-md transition-all duration-200 font-medium disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="adminRegister"
                checked={isAdminRegister}
                onChange={(e) => setIsAdminRegister(e.target.checked)}
                className="h-4 w-4 text-[#01953f] focus:ring-[#01953f] border-gray-300 rounded"
              />
              <label htmlFor="adminRegister" className="ml-2 block text-sm text-gray-700">
                Register as Admin (requires invite code)
              </label>
            </div>

            {isAdminRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Invite Code
                </label>
                <input
                  type="text"
                  value={registerData.inviteCode}
                  onChange={(e) => setRegisterData({...registerData, inviteCode: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                  placeholder="Enter admin invite code"
                  required={isAdminRegister}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={registerData.username}
                onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={registerData.email}
                onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={registerData.confirmPassword}
                onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#01953f]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#01953f] hover:bg-[#01fb6a] hover:text-black text-white py-2 px-4 rounded-md transition-all duration-200 font-medium disabled:opacity-50"
            >
              {isLoading
                ? (isAdminRegister ? 'Creating Admin Account...' : 'Creating Account...')
                : (isAdminRegister ? 'Create Admin Account' : 'Create Account')
              }
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={switchMode}
            className="text-[#01953f] hover:underline text-sm"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;