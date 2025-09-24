'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, ArrowLeft, BookOpen, MessageCircle, History, Star, User, Bot, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Educator {
  id: number;
  username: string;
  title: string;
  department?: string;
  institution?: string;
  bio?: string;
  specializations: string[];
  rating: number;
  total_ratings: number;
}

interface Lecture {
  id: number;
  title: string;
  description?: string;
  subject: string;
  difficulty_level: string;
  educator_name: string;
  educator_title: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  confidence?: number;
  lecture_title?: string;
}

interface Interaction {
  id: number;
  question: string;
  ai_response: string;
  lecture_title: string;
  confidence: number;
  created_at: string;
}

interface StudentChatProps {
  token: string;
  educator: Educator;
  selectedLecture?: Lecture;
  onBack: () => void;
}

export default function StudentChat({ token, educator, selectedLecture, onBack }: StudentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Interaction[]>([]);
  const [availableLectures, setAvailableLectures] = useState<Lecture[]>([]);
  const [currentLecture, setCurrentLecture] = useState<Lecture | null>(selectedLecture || null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load educator's lectures
  useEffect(() => {
    const loadLectures = async () => {
      try {
        const response = await fetch('http://localhost:8001/education/lectures/public', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const lectures = await response.json();
          const educatorLectures = lectures.filter((l: Lecture) =>
            l.educator_name === educator.username
          );
          setAvailableLectures(educatorLectures);
        }
      } catch (error) {
        console.error('Error loading lectures:', error);
      }
    };

    loadLectures();
  }, [token, educator]);

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`http://localhost:8001/education/interactions/history?educator_id=${educator.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const historyData = await response.json();
          setHistory(historyData);
        }
      } catch (error) {
        console.error('Error loading history:', error);
      }
    };

    loadHistory();
  }, [token, educator.id]);

  // Initialize chat with welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: `welcome_${Date.now()}`,
      type: 'ai',
      content: `Hello! I'm ${educator.title} ${educator.username}'s AI assistant. I'm here to help you with questions about ${educator.specializations.join(', ')}. ${currentLecture ? `Let's discuss my lecture "${currentLecture.title}".` : 'Please select a lecture to get started, or ask me general questions about my expertise.'} How can I help you today?`,
      timestamp: new Date(),
      confidence: 1.0,
    };

    setMessages([welcomeMessage]);
  }, [educator, currentLecture]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      if (!currentLecture) {
        // If no lecture is selected, prompt user to select one
        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          type: 'ai',
          content: `I'd be happy to help you! To provide the most accurate and contextual responses, please select one of my lectures from the list below. This will allow me to answer questions based on the specific content I've covered.`,
          timestamp: new Date(),
          confidence: 1.0,
        };
        setMessages(prev => [...prev, aiMessage]);
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8001/education/ask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: inputMessage,
          lecture_id: currentLecture.id,
          session_id: sessionId,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        const aiMessage: ChatMessage = {
          id: `ai_${Date.now()}`,
          type: 'ai',
          content: result.response,
          timestamp: new Date(),
          confidence: result.confidence,
          lecture_title: result.lecture_title,
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        content: 'I apologize, but I encountered an error processing your question. Please try again or select a different lecture.',
        timestamp: new Date(),
        confidence: 0,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const HistoryPanel = () => (
    <div className="bg-theme-secondary rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium text-theme-primary">Chat History</h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-theme-secondary hover:text-theme-primary"
        >
          {showHistory ? 'Hide' : 'Show'}
        </button>
      </div>

      {showHistory && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-theme-tertiary">No previous conversations</p>
          ) : (
            history.slice(0, 5).map((interaction) => (
              <div key={interaction.id} className="p-2 bg-theme-primary rounded border border-theme-border">
                <p className="text-xs font-medium text-theme-primary line-clamp-1">
                  Q: {interaction.question}
                </p>
                <p className="text-xs text-theme-secondary line-clamp-2 mt-1">
                  A: {interaction.ai_response}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-theme-tertiary">{interaction.lecture_title}</span>
                  <span className="text-xs text-theme-tertiary">
                    {new Date(interaction.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col">
      {/* Header */}
      <div className="bg-theme-secondary border-b border-theme-border p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Selection
          </button>

          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-theme-tertiary" />
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-theme-secondary hover:text-theme-primary"
            >
              History
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-theme-primary">
                {educator.title} {educator.username}
              </h2>
              <div className="flex items-center gap-2 text-sm text-theme-secondary">
                <span>{educator.department}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-current" />
                  <span>{educator.rating.toFixed(1)} ({educator.total_ratings})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lecture Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-theme-primary mb-2">
              Select a lecture to discuss:
            </label>
            <select
              value={currentLecture?.id || ''}
              onChange={(e) => {
                const lectureId = parseInt(e.target.value);
                const lecture = availableLectures.find(l => l.id === lectureId);
                setCurrentLecture(lecture || null);
              }}
              className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a lecture...</option>
              {availableLectures.map((lecture) => (
                <option key={lecture.id} value={lecture.id}>
                  {lecture.title} ({lecture.subject})
                </option>
              ))}
            </select>
          </div>

          {currentLecture && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{currentLecture.title}</span>
              </div>
              {currentLecture.description && (
                <p className="text-xs text-blue-700 line-clamp-2">{currentLecture.description}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History Panel */}
      <div className="p-4">
        <HistoryPanel />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.type === 'user'
                ? 'bg-blue-600'
                : 'bg-green-600'
            }`}>
              {message.type === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            <div className={`max-w-2xl ${message.type === 'user' ? 'text-right' : ''}`}>
              <div className={`p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-theme-secondary text-theme-primary border border-theme-border'
              }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.type === 'ai' && message.confidence !== undefined && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-theme-border opacity-70">
                    <div className="flex items-center gap-2 text-xs">
                      {message.lecture_title && (
                        <span>From: {message.lecture_title}</span>
                      )}
                      <span>Confidence: {(message.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1 hover:bg-theme-border rounded"
                        title="Copy message"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 hover:bg-theme-border rounded text-green-600"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 hover:bg-theme-border rounded text-red-600"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-theme-tertiary mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-theme-secondary p-3 rounded-lg border border-theme-border">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-theme-tertiary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-theme-tertiary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-theme-tertiary rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-theme-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={currentLecture ? "Ask a question about the lecture..." : "Please select a lecture first..."}
            disabled={!currentLecture || loading}
            className="flex-1 px-4 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || !currentLecture || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {!currentLecture && (
          <p className="text-sm text-theme-secondary mt-2">
            💡 Select a lecture above to start asking questions about specific content.
          </p>
        )}
      </div>
    </div>
  );
}