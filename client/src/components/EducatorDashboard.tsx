'use client';

import { useState, useEffect } from 'react';
import { Upload, BookOpen, Users, BarChart3, Plus, Edit, Trash2, Eye, FileText, Calendar, Award, X, AlertCircle } from 'lucide-react';

interface Educator {
  id: number;
  username: string;
  email: string;
  title: string;
  department?: string;
  institution?: string;
  bio?: string;
  specializations: string[];
  credentials: string[];
  experience_years: number;
  rating: number;
  total_ratings: number;
  is_verified: boolean;
  lecture_count: number;
  created_at: string;
}

interface Lecture {
  id: number;
  title: string;
  description?: string;
  subject: string;
  difficulty_level: string;
  is_processed: boolean;
  processing_status: string;
  view_count: number;
  question_count: number;
  avg_satisfaction?: number;
  created_at: string;
}

interface EducatorDashboardProps {
  token: string;
}

export default function EducatorDashboard({ token }: EducatorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'lectures' | 'analytics'>('profile');
  const [educator, setEducator] = useState<Educator | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Educator>>({});
  const [showCreateLecture, setShowCreateLecture] = useState(false);
  const [lectureForm, setLectureForm] = useState({
    title: '',
    subject: '',
    description: '',
    difficulty_level: 'intermediate',
    topic_tags: '',
    learning_objectives: '',
  });
  const [lectureFile, setLectureFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Load educator profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        let response = await fetch('http://localhost:8001/education/educators/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        // If profile doesn't exist, try to convert current user to educator
        if (!response.ok && response.status === 404) {
          const convertResponse = await fetch('http://localhost:8001/education/auth/convert-to-educator', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: 'Professor',
              department: 'General',
              institution: 'Institution',
              bio: 'Experienced educator and researcher.',
              specializations: ['Teaching', 'Research'],
              credentials: ['PhD']
            }),
          });

          if (convertResponse.ok) {
            // Try to load profile again
            response = await fetch('http://localhost:8001/education/educators/me', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
          }
        }

        if (response.ok) {
          const profile = await response.json();
          setEducator(profile);
          setEditForm(profile);
        } else {
          setError('Failed to load educator profile');
        }
      } catch (err) {
        setError('Network error loading profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token]);

  // Load lectures
  useEffect(() => {
    const loadLectures = async () => {
      try {
        const response = await fetch('http://localhost:8001/education/lectures/my', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const lecturesData = await response.json();
          setLectures(lecturesData);
        }
      } catch (err) {
        console.error('Error loading lectures:', err);
      }
    };

    if (token) {
      loadLectures();
    }
  }, [token]);

  const handleProfileUpdate = async () => {
    if (!educator) return;

    try {
      const response = await fetch('http://localhost:8001/education/educators/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setEducator(updatedProfile);
        setIsEditing(false);
      } else {
        setError('Failed to update profile');
      }
    } catch (err) {
      setError('Network error updating profile');
    }
  };

  const handleCreateLecture = async () => {
    if (!lectureForm.title || !lectureForm.subject) {
      setError('Title and subject are required');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // First, create the lecture
      const lectureData = {
        ...lectureForm,
        topic_tags: lectureForm.topic_tags ? lectureForm.topic_tags.split(',').map(tag => tag.trim()) : [],
        learning_objectives: lectureForm.learning_objectives ? lectureForm.learning_objectives.split(',').map(obj => obj.trim()) : [],
      };

      const response = await fetch('http://localhost:8001/education/lectures', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lectureData),
      });

      if (!response.ok) {
        throw new Error('Failed to create lecture');
      }

      const lecture = await response.json();
      setUploadProgress(50);

      // If there's a file, upload it
      if (lectureFile) {
        const formData = new FormData();
        formData.append('file', lectureFile);

        const uploadResponse = await fetch(`http://localhost:8001/education/lectures/${lecture.id}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload lecture content');
        }

        setUploadProgress(100);
      }

      // Reset form and reload lectures
      setLectureForm({
        title: '',
        subject: '',
        description: '',
        difficulty_level: 'intermediate',
        topic_tags: '',
        learning_objectives: '',
      });
      setLectureFile(null);
      setShowCreateLecture(false);

      // Reload lectures
      const lecturesResponse = await fetch('http://localhost:8001/education/lectures/my', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (lecturesResponse.ok) {
        const lecturesData = await lecturesResponse.json();
        setLectures(lecturesData);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lecture');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const CreateLectureModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-theme-primary">Create New Lecture</h3>
            <button
              onClick={() => setShowCreateLecture(false)}
              className="text-theme-secondary hover:text-theme-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-2">Title *</label>
                <input
                  type="text"
                  value={lectureForm.title}
                  onChange={(e) => setLectureForm({...lectureForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Introduction to Machine Learning"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-2">Subject *</label>
                <input
                  type="text"
                  value={lectureForm.subject}
                  onChange={(e) => setLectureForm({...lectureForm, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Computer Science"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-2">Description</label>
              <textarea
                rows={3}
                value={lectureForm.description}
                onChange={(e) => setLectureForm({...lectureForm, description: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the lecture content..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-2">Difficulty Level</label>
              <select
                value={lectureForm.difficulty_level}
                onChange={(e) => setLectureForm({...lectureForm, difficulty_level: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-2">Topic Tags</label>
              <input
                type="text"
                value={lectureForm.topic_tags}
                onChange={(e) => setLectureForm({...lectureForm, topic_tags: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., algorithms, neural networks, supervised learning (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-2">Learning Objectives</label>
              <input
                type="text"
                value={lectureForm.learning_objectives}
                onChange={(e) => setLectureForm({...lectureForm, learning_objectives: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., understand basic concepts, apply algorithms (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-2">Lecture Content</label>
              <div className="border-2 border-dashed border-theme-border rounded-lg p-6 text-center">
                {lectureFile ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 text-blue-600 mx-auto" />
                    <p className="text-sm text-theme-primary">{lectureFile.name}</p>
                    <p className="text-xs text-theme-secondary">
                      {(lectureFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setLectureFile(null)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-theme-tertiary mx-auto mb-2" />
                    <p className="text-sm text-theme-secondary mb-2">
                      Upload lecture content (video, audio, PDF, text)
                    </p>
                    <input
                      type="file"
                      accept=".mp4,.mp3,.pdf,.txt,.docx,.pptx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setLectureFile(file);
                      }}
                      className="hidden"
                      id="lecture-file"
                    />
                    <label
                      htmlFor="lecture-file"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      Choose File
                    </label>
                  </div>
                )}
              </div>
              <p className="text-xs text-theme-tertiary mt-1">
                Supported formats: MP4, MP3, PDF, TXT, DOCX, PPTX (Max 100MB)
              </p>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-theme-secondary">Uploading...</span>
                  <span className="text-theme-secondary">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-theme-border rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-theme-border">
            <button
              onClick={() => setShowCreateLecture(false)}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-border transition-colors"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLecture}
              disabled={isUploading || !lectureForm.title || !lectureForm.subject}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Creating...' : 'Create Lecture'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const ProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-theme-secondary rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-theme-primary">Profile Information</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Institution</label>
                <input
                  type="text"
                  value={editForm.institution || ''}
                  onChange={(e) => setEditForm({...editForm, institution: e.target.value})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Experience (years)</label>
                <input
                  type="number"
                  value={editForm.experience_years || 0}
                  onChange={(e) => setEditForm({...editForm, experience_years: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Bio</label>
              <textarea
                rows={4}
                value={editForm.bio || ''}
                onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Specializations (comma-separated)</label>
              <input
                type="text"
                value={editForm.specializations?.join(', ') || ''}
                onChange={(e) => setEditForm({...editForm, specializations: e.target.value.split(',').map(s => s.trim())})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Credentials (comma-separated)</label>
              <input
                type="text"
                value={editForm.credentials?.join(', ') || ''}
                onChange={(e) => setEditForm({...editForm, credentials: e.target.value.split(',').map(s => s.trim())})}
                className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleProfileUpdate}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-theme-primary mb-2">Basic Information</h4>
                <div className="space-y-2 text-sm text-theme-secondary">
                  <p><span className="font-medium">Title:</span> {educator?.title}</p>
                  <p><span className="font-medium">Department:</span> {educator?.department || 'Not specified'}</p>
                  <p><span className="font-medium">Institution:</span> {educator?.institution || 'Not specified'}</p>
                  <p><span className="font-medium">Experience:</span> {educator?.experience_years} years</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-theme-primary mb-2">Performance</h4>
                <div className="space-y-2 text-sm text-theme-secondary">
                  <p><span className="font-medium">Rating:</span> {educator?.rating.toFixed(1)}/5.0 ({educator?.total_ratings} reviews)</p>
                  <p><span className="font-medium">Lectures:</span> {educator?.lecture_count}</p>
                  <p><span className="font-medium">Verified:</span> {educator?.is_verified ? '✓ Verified' : 'Not verified'}</p>
                  <p><span className="font-medium">Member since:</span> {new Date(educator?.created_at || '').toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {educator?.bio && (
              <div>
                <h4 className="font-medium text-theme-primary mb-2">Bio</h4>
                <p className="text-sm text-theme-secondary">{educator.bio}</p>
              </div>
            )}

            {educator?.specializations && educator.specializations.length > 0 && (
              <div>
                <h4 className="font-medium text-theme-primary mb-2">Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  {educator.specializations.map((spec, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {educator?.credentials && educator.credentials.length > 0 && (
              <div>
                <h4 className="font-medium text-theme-primary mb-2">Credentials</h4>
                <div className="flex flex-wrap gap-2">
                  {educator.credentials.map((cred, index) => (
                    <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const LecturesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-theme-primary">My Lectures</h3>
        <button
          onClick={() => setShowCreateLecture(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New Lecture
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lectures.map((lecture) => (
          <div key={lecture.id} className="bg-theme-secondary rounded-lg p-6 border border-theme-border">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-theme-primary line-clamp-2">{lecture.title}</h4>
              <span className={`px-2 py-1 text-xs rounded-full ${
                lecture.is_processed
                  ? 'bg-green-100 text-green-800'
                  : lecture.processing_status === 'processing'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}>
                {lecture.processing_status}
              </span>
            </div>

            <p className="text-sm text-theme-secondary mb-3 line-clamp-2">{lecture.description}</p>

            <div className="space-y-2 text-xs text-theme-tertiary">
              <div className="flex justify-between">
                <span>Subject:</span>
                <span>{lecture.subject}</span>
              </div>
              <div className="flex justify-between">
                <span>Level:</span>
                <span className="capitalize">{lecture.difficulty_level}</span>
              </div>
              <div className="flex justify-between">
                <span>Views:</span>
                <span>{lecture.view_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Questions:</span>
                <span>{lecture.question_count}</span>
              </div>
              {lecture.avg_satisfaction && (
                <div className="flex justify-between">
                  <span>Satisfaction:</span>
                  <span>{lecture.avg_satisfaction.toFixed(1)}/5.0</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-theme-border">
              <span className="text-xs text-theme-tertiary">
                {new Date(lecture.created_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                <button className="p-1 text-theme-secondary hover:text-blue-600 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-1 text-theme-secondary hover:text-blue-600 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-1 text-theme-secondary hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {lectures.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-theme-tertiary mx-auto mb-4" />
          <h4 className="text-lg font-medium text-theme-primary mb-2">No lectures yet</h4>
          <p className="text-theme-secondary">Create your first lecture to get started!</p>
        </div>
      )}
    </div>
  );

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-theme-primary">Analytics & Insights</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-theme-secondary rounded-lg p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-theme-primary">{educator?.lecture_count || 0}</p>
              <p className="text-sm text-theme-secondary">Total Lectures</p>
            </div>
          </div>
        </div>

        <div className="bg-theme-secondary rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-theme-primary">0</p>
              <p className="text-sm text-theme-secondary">Total Students</p>
            </div>
          </div>
        </div>

        <div className="bg-theme-secondary rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-theme-primary">{educator?.rating.toFixed(1) || '0.0'}</p>
              <p className="text-sm text-theme-secondary">Average Rating</p>
            </div>
          </div>
        </div>

        <div className="bg-theme-secondary rounded-lg p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-theme-primary">0</p>
              <p className="text-sm text-theme-secondary">Total Questions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-secondary rounded-lg p-6">
        <h4 className="font-semibold text-theme-primary mb-4">Recent Activity</h4>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-theme-tertiary mx-auto mb-4" />
          <p className="text-theme-secondary">No recent activity to display</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Educator Dashboard</h1>
        <p className="text-theme-secondary">Welcome back, {educator?.title} {educator?.username}!</p>
      </div>

      <div className="flex space-x-1 mb-8 border-b border-theme-border">
        {[
          { key: 'profile', label: 'Profile', icon: Users },
          { key: 'lectures', label: 'Lectures', icon: BookOpen },
          { key: 'analytics', label: 'Analytics', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-theme-secondary hover:text-theme-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'lectures' && <LecturesTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}

      {showCreateLecture && <CreateLectureModal />}
    </div>
  );
}