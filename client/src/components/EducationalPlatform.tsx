'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Users, BookOpen, MessageSquare, UserCheck, LogOut, Settings, PlusCircle, ChevronRight } from 'lucide-react';
import EducatorDashboard from './EducatorDashboard';
import EducatorSelector from './EducatorSelector';
import StudentChat from './StudentChat';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'educator' | 'student';
}

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

interface EducationalPlatformProps {
  token: string;
  user: User;
  onLogout: () => void;
}

type ViewMode = 'landing' | 'educator-dashboard' | 'student-selector' | 'student-chat';

export default function EducationalPlatform({ token, user, onLogout }: EducationalPlatformProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [selectedEducator, setSelectedEducator] = useState<Educator | null>(null);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if user is an educator on platform load
  useEffect(() => {
    if (user.role === 'educator') {
      setViewMode('educator-dashboard');
    }
  }, [user.role]);

  const handleSelectEducator = (educator: Educator, lecture?: Lecture) => {
    setSelectedEducator(educator);
    setSelectedLecture(lecture || null);
    setViewMode('student-chat');
  };

  const handleBackToSelector = () => {
    setSelectedEducator(null);
    setSelectedLecture(null);
    setViewMode('student-selector');
  };

  const handleBackToLanding = () => {
    setViewMode('landing');
  };

  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-theme-primary">EduClone AI Platform</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-sm text-theme-secondary">
                {user.username} ({user.role})
              </span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-bold text-theme-primary mb-6">
            Learn from AI
            <span className="text-blue-600"> Educator Clones</span>
          </h2>
          <p className="text-xl text-theme-secondary mb-8 max-w-3xl mx-auto">
            Connect with AI-powered versions of expert educators. Ask questions, get personalized help, and learn at your own pace with contextual responses based on real lecture content.
          </p>
        </div>

        {/* User Role Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Student Card */}
          <div className="bg-theme-secondary rounded-2xl p-8 border border-theme-border hover:border-blue-500 transition-all duration-300 hover:shadow-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-theme-primary mb-2">I'm a Student</h3>
              <p className="text-theme-secondary">
                Browse educators, select lectures, and chat with AI educator clones for personalized learning.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-theme-secondary">Browse expert educators and their lectures</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-theme-secondary">Ask questions to AI educator clones</span>
              </div>
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-theme-secondary">Get contextual, lecture-specific answers</span>
              </div>
            </div>

            <button
              onClick={() => setViewMode('student-selector')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Learning
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Educator Card */}
          <div className="bg-theme-secondary rounded-2xl p-8 border border-theme-border hover:border-green-500 transition-all duration-300 hover:shadow-lg">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-theme-primary mb-2">I'm an Educator</h3>
              <p className="text-theme-secondary">
                Create your AI clone by uploading lectures and let students interact with your expertise.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <PlusCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-theme-secondary">Upload and manage your lectures</span>
              </div>
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-green-600" />
                <span className="text-sm text-theme-secondary">Create your AI educator profile</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <span className="text-sm text-theme-secondary">Let students interact with your AI clone</span>
              </div>
            </div>

            <button
              onClick={() => setViewMode(user.role === 'educator' ? 'educator-dashboard' : 'student-selector')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              {user.role === 'educator' ? 'Go to Dashboard' : 'Login as Admin to Access'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24">
          <h3 className="text-3xl font-bold text-center text-theme-primary mb-12">
            How EduClone AI Works
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">1</span>
              </div>
              <h4 className="text-lg font-semibold text-theme-primary mb-2">Educators Upload Content</h4>
              <p className="text-theme-secondary">
                Educators upload their lectures (video, audio, text, PDFs) which get processed and indexed by our AI.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">2</span>
              </div>
              <h4 className="text-lg font-semibold text-theme-primary mb-2">AI Creates Educator Clones</h4>
              <p className="text-theme-secondary">
                Our AI analyzes the content and creates intelligent clones that can answer questions in the educator's context.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">3</span>
              </div>
              <h4 className="text-lg font-semibold text-theme-primary mb-2">Students Interact & Learn</h4>
              <p className="text-theme-secondary">
                Students select educators and lectures, then chat with AI clones for personalized, contextual learning.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const EducatorSignupForm = () => {
    const [formData, setFormData] = useState({
      title: 'Professor',
      department: '',
      institution: '',
      bio: '',
      specializations: '',
      credentials: '',
    });

    const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
        const response = await fetch('http://localhost:8001/education/auth/register-educator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: user.username,
            email: user.email,
            password: 'temp_password', // This would need proper password handling
            ...formData,
            specializations: formData.specializations.split(',').map(s => s.trim()).filter(Boolean),
            credentials: formData.credentials.split(',').map(s => s.trim()).filter(Boolean),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Update the token with the new educator token
          if (result.access_token) {
            localStorage.setItem('authToken', result.access_token);
            // Also update user data if provided
            if (result.user) {
              localStorage.setItem('userData', JSON.stringify(result.user));
            }
          }
          setViewMode('educator-dashboard');
        } else {
          const error = await response.json();
          alert(`Signup failed: ${error.detail}`);
        }
      } catch (error) {
        alert('Network error during signup');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-theme-secondary rounded-lg p-8 border border-theme-border">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-theme-primary mb-2">Become an Educator</h2>
            <p className="text-theme-secondary">Complete your educator profile to start creating AI clones</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Title</label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="Professor">Professor</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Instructor">Instructor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Computer Science"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Institution</label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => setFormData({...formData, institution: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., University of California"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                rows={4}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell students about your expertise and teaching philosophy..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Specializations</label>
              <input
                type="text"
                value={formData.specializations}
                onChange={(e) => setFormData({...formData, specializations: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Machine Learning, Data Science, Algorithms (comma-separated)"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-primary mb-2">Credentials</label>
              <input
                type="text"
                value={formData.credentials}
                onChange={(e) => setFormData({...formData, credentials: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., PhD Computer Science, Google AI Researcher (comma-separated)"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleBackToLanding}
                className="flex-1 px-6 py-2 border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-border transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating Profile...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render based on current view mode
  switch (viewMode) {
    case 'educator-dashboard':
      return <EducatorDashboard token={token} />;

    case 'student-selector':
      return <EducatorSelector token={token} onSelectEducator={handleSelectEducator} />;

    case 'student-chat':
      return selectedEducator ? (
        <StudentChat
          token={token}
          educator={selectedEducator}
          selectedLecture={selectedLecture || undefined}
          onBack={handleBackToSelector}
        />
      ) : null;


    default:
      return <LandingPage />;
  }
}