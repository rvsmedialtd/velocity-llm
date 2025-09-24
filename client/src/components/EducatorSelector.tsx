'use client';

import { useState, useEffect } from 'react';
import { Search, Star, Users, BookOpen, Award, ChevronRight, Filter, GraduationCap } from 'lucide-react';

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
  view_count: number;
  question_count: number;
  educator_name: string;
  educator_title: string;
  institution?: string;
  educator_rating: number;
  created_at: string;
}

interface EducatorSelectorProps {
  token: string;
  onSelectEducator: (educator: Educator, lecture?: Lecture) => void;
}

export default function EducatorSelector({ token, onSelectEducator }: EducatorSelectorProps) {
  const [educators, setEducators] = useState<Educator[]>([]);
  const [publicLectures, setPublicLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [viewMode, setViewMode] = useState<'educators' | 'lectures'>('educators');
  const [subjects, setSubjects] = useState<string[]>([]);

  // Load educators and lectures
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load educators
        const educatorsResponse = await fetch('http://localhost:8001/education/educators', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (educatorsResponse.ok) {
          const educatorsData = await educatorsResponse.json();
          setEducators(educatorsData);
        }

        // Load public lectures
        const lecturesResponse = await fetch(`http://localhost:8001/education/lectures/public${selectedSubject ? `?subject=${selectedSubject}` : ''}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (lecturesResponse.ok) {
          const lecturesData = await lecturesResponse.json();
          setPublicLectures(lecturesData);
        }

        // Load subjects
        const subjectsResponse = await fetch('http://localhost:8001/education/subjects', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          setSubjects(subjectsData);
        }

      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadData();
    }
  }, [token, selectedSubject]);

  // Filter educators based on search
  const filteredEducators = educators.filter(educator => {
    const matchesSearch = !searchQuery ||
      educator.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      educator.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      educator.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      educator.institution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      educator.specializations.some(spec => spec.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSubject = !selectedSubject ||
      educator.specializations.some(spec => spec.toLowerCase().includes(selectedSubject.toLowerCase()));

    return matchesSearch && matchesSubject;
  });

  // Filter lectures based on search
  const filteredLectures = publicLectures.filter(lecture => {
    const matchesSearch = !searchQuery ||
      lecture.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lecture.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lecture.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lecture.educator_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch && lecture.is_processed;
  });

  const EducatorCard = ({ educator }: { educator: Educator }) => (
    <div className="bg-theme-secondary rounded-lg p-6 border border-theme-border hover:border-blue-500 transition-colors cursor-pointer"
         onClick={() => onSelectEducator(educator)}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">{educator.title} {educator.username}</h3>
          <p className="text-theme-secondary text-sm">{educator.department} • {educator.institution}</p>
        </div>
        <div className="flex items-center gap-1">
          {educator.is_verified && <Award className="w-4 h-4 text-yellow-500" />}
          <ChevronRight className="w-5 h-5 text-theme-tertiary" />
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-current" />
          <span className="text-sm font-medium text-theme-primary">{educator.rating.toFixed(1)}</span>
          <span className="text-xs text-theme-tertiary">({educator.total_ratings})</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-theme-secondary">{educator.lecture_count} lectures</span>
        </div>
        <div className="flex items-center gap-1">
          <GraduationCap className="w-4 h-4 text-green-500" />
          <span className="text-sm text-theme-secondary">{educator.experience_years}y exp</span>
        </div>
      </div>

      {educator.bio && (
        <p className="text-sm text-theme-secondary mb-4 line-clamp-2">{educator.bio}</p>
      )}

      {educator.specializations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {educator.specializations.slice(0, 3).map((spec, index) => (
            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
              {spec}
            </span>
          ))}
          {educator.specializations.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
              +{educator.specializations.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );

  const LectureCard = ({ lecture }: { lecture: Lecture }) => {
    const educator = educators.find(e => e.username === lecture.educator_name);

    return (
      <div className="bg-theme-secondary rounded-lg p-6 border border-theme-border hover:border-blue-500 transition-colors cursor-pointer"
           onClick={() => onSelectEducator(educator!, lecture)}>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-theme-primary line-clamp-2">{lecture.title}</h3>
          <ChevronRight className="w-5 h-5 text-theme-tertiary flex-shrink-0 ml-2" />
        </div>

        <div className="text-sm text-theme-secondary mb-3">
          <p className="font-medium">{lecture.educator_title} {lecture.educator_name}</p>
          <p>{lecture.institution}</p>
        </div>

        {lecture.description && (
          <p className="text-sm text-theme-secondary mb-4 line-clamp-2">{lecture.description}</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-xs text-theme-tertiary">
            <span className="capitalize">{lecture.difficulty_level}</span>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{lecture.view_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              <span>{lecture.question_count} questions</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm font-medium text-theme-primary">{lecture.educator_rating?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            {lecture.subject}
          </span>
          <span className="text-xs text-theme-tertiary">
            {new Date(lecture.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-theme-primary mb-2">Choose Your AI Educator</h1>
        <p className="text-theme-secondary">Select an educator or specific lecture to start your personalized learning experience.</p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex space-x-1 mb-6 border border-theme-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode('educators')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'educators'
              ? 'bg-blue-600 text-white'
              : 'text-theme-secondary hover:text-theme-primary'
          }`}
        >
          Browse Educators
        </button>
        <button
          onClick={() => setViewMode('lectures')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'lectures'
              ? 'bg-blue-600 text-white'
              : 'text-theme-secondary hover:text-theme-primary'
          }`}
        >
          Browse Lectures
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={viewMode === 'educators' ? "Search educators..." : "Search lectures..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-2 border border-theme-border rounded-lg bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {viewMode === 'educators' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEducators.map((educator) => (
            <EducatorCard key={educator.id} educator={educator} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLectures.map((lecture) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {((viewMode === 'educators' && filteredEducators.length === 0) ||
        (viewMode === 'lectures' && filteredLectures.length === 0)) && (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-theme-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme-primary mb-2">
            No {viewMode} found
          </h3>
          <p className="text-theme-secondary">
            Try adjusting your search criteria or browse different subjects.
          </p>
        </div>
      )}
    </div>
  );
}