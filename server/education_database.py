"""
Educational AI Clone Platform database extensions.
This module extends the existing database with educational-specific tables.
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional, Dict, List, Any
import json
from database import get_db_connection, DATABASE_PATH

def init_education_database():
    """Initialize educational platform tables."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # Educators table - extends user authentication for educators
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS educators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT 'Professor',
            department TEXT,
            institution TEXT,
            bio TEXT,
            specializations TEXT,  -- JSON array of specializations
            credentials TEXT,      -- JSON array of credentials/degrees
            experience_years INTEGER DEFAULT 0,
            profile_image_path TEXT,
            rating REAL DEFAULT 0.0,
            total_ratings INTEGER DEFAULT 0,
            is_verified BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id)
        )
    ''')

    # Lectures table - stores lecture content and metadata
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lectures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            educator_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            subject TEXT NOT NULL,
            topic_tags TEXT,       -- JSON array of topic tags
            lecture_type TEXT DEFAULT 'video',  -- video, audio, text, presentation
            content_path TEXT,     -- File path to lecture content
            transcript_path TEXT,  -- Path to transcript file
            duration_minutes INTEGER,
            difficulty_level TEXT DEFAULT 'intermediate',  -- beginner, intermediate, advanced
            prerequisite_topics TEXT,  -- JSON array of prerequisite topics
            learning_objectives TEXT,  -- JSON array of learning objectives
            is_processed BOOLEAN DEFAULT 0,  -- Whether content is processed for AI
            processing_status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
            chroma_collection_id TEXT,  -- ChromaDB collection for this lecture
            view_count INTEGER DEFAULT 0,
            is_public BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (educator_id) REFERENCES educators (id)
        )
    ''')

    # Student interactions table - tracks student queries and responses
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            educator_id INTEGER NOT NULL,
            lecture_id INTEGER,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            response_type TEXT DEFAULT 'direct',  -- direct, practice_problem, explanation
            context_used TEXT,     -- JSON of context chunks used for response
            satisfaction_rating INTEGER,  -- 1-5 rating from student
            feedback TEXT,
            response_time_ms INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users (id),
            FOREIGN KEY (educator_id) REFERENCES educators (id),
            FOREIGN KEY (lecture_id) REFERENCES lectures (id)
        )
    ''')

    # Lecture analytics table - tracks lecture performance and student engagement
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lecture_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lecture_id INTEGER NOT NULL,
            educator_id INTEGER NOT NULL,
            metric_type TEXT NOT NULL,  -- views, questions, avg_rating, completion_rate
            metric_value REAL NOT NULL,
            time_period TEXT DEFAULT 'daily',  -- daily, weekly, monthly
            date_recorded DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lecture_id) REFERENCES lectures (id),
            FOREIGN KEY (educator_id) REFERENCES educators (id)
        )
    ''')

    # Student progress tracking table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            educator_id INTEGER NOT NULL,
            lecture_id INTEGER NOT NULL,
            topics_covered TEXT,   -- JSON array of covered topics
            quiz_scores TEXT,      -- JSON array of quiz results
            time_spent_minutes INTEGER DEFAULT 0,
            completion_percentage REAL DEFAULT 0.0,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            mastery_level TEXT DEFAULT 'beginner',  -- beginner, developing, proficient, advanced
            notes TEXT,           -- Student's personal notes
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users (id),
            FOREIGN KEY (educator_id) REFERENCES educators (id),
            FOREIGN KEY (lecture_id) REFERENCES lectures (id),
            UNIQUE(student_id, educator_id, lecture_id)
        )
    ''')

    # Practice problems table - AI-generated practice problems
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS practice_problems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lecture_id INTEGER NOT NULL,
            educator_id INTEGER NOT NULL,
            problem_text TEXT NOT NULL,
            problem_type TEXT DEFAULT 'multiple_choice',  -- multiple_choice, short_answer, essay, calculation
            correct_answer TEXT,
            explanation TEXT,
            difficulty_level TEXT DEFAULT 'intermediate',
            topic_tags TEXT,      -- JSON array of related topics
            created_by_ai BOOLEAN DEFAULT 1,
            usage_count INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lecture_id) REFERENCES lectures (id),
            FOREIGN KEY (educator_id) REFERENCES educators (id)
        )
    ''')

    # Student favorites/bookmarks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            educator_id INTEGER NOT NULL,
            lecture_id INTEGER,
            favorite_type TEXT DEFAULT 'educator',  -- educator, lecture
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users (id),
            FOREIGN KEY (educator_id) REFERENCES educators (id),
            FOREIGN KEY (lecture_id) REFERENCES lectures (id),
            UNIQUE(student_id, educator_id, lecture_id, favorite_type)
        )
    ''')

    # Educator reviews table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS educator_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            educator_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            lecture_id INTEGER,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            review_text TEXT,
            is_verified BOOLEAN DEFAULT 0,
            is_public BOOLEAN DEFAULT 1,
            helpful_votes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (educator_id) REFERENCES educators (id),
            FOREIGN KEY (student_id) REFERENCES users (id),
            FOREIGN KEY (lecture_id) REFERENCES lectures (id),
            UNIQUE(educator_id, student_id, lecture_id)
        )
    ''')

    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_lectures_educator ON lectures(educator_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_lectures_subject ON lectures(subject)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_student ON student_interactions(student_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_educator ON student_interactions(educator_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_lecture ON student_interactions(lecture_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_progress_student ON student_progress(student_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analytics_lecture ON lecture_analytics(lecture_id)')

    conn.commit()
    conn.close()

class EducatorDB:
    """Educator database operations."""

    @staticmethod
    def create_educator(user_id: int, title: str = "Professor", department: str = None,
                       institution: str = None, bio: str = None) -> Optional[int]:
        """Create a new educator profile."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO educators (user_id, title, department, institution, bio)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, title, department, institution, bio))

            educator_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return educator_id
        except sqlite3.IntegrityError:
            conn.close()
            return None

    @staticmethod
    def get_educator_by_user_id(user_id: int) -> Optional[Dict]:
        """Get educator profile by user ID."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT e.*, u.username, u.email
            FROM educators e
            JOIN users u ON e.user_id = u.id
            WHERE e.user_id = ? AND e.is_active = 1
        ''', (user_id,))

        educator = cursor.fetchone()
        conn.close()
        return dict(educator) if educator else None

    @staticmethod
    def get_all_educators(limit: int = 50, offset: int = 0) -> List[Dict]:
        """Get all active educators with pagination."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT e.*, u.username, u.email,
                   COUNT(l.id) as lecture_count
            FROM educators e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN lectures l ON e.id = l.educator_id AND l.is_public = 1
            WHERE e.is_active = 1
            GROUP BY e.id
            ORDER BY e.rating DESC, e.created_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset))

        educators = cursor.fetchall()
        conn.close()
        return [dict(educator) for educator in educators]

    @staticmethod
    def search_educators(query: str, subject: str = None) -> List[Dict]:
        """Search educators by name, institution, or specializations."""
        conn = get_db_connection()
        cursor = conn.cursor()

        sql = '''
            SELECT e.*, u.username, u.email,
                   COUNT(l.id) as lecture_count
            FROM educators e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN lectures l ON e.id = l.educator_id AND l.is_public = 1
            WHERE e.is_active = 1 AND (
                u.username LIKE ? OR
                e.institution LIKE ? OR
                e.department LIKE ? OR
                e.specializations LIKE ?
            )
        '''
        params = [f'%{query}%'] * 4

        if subject:
            sql += ' AND EXISTS (SELECT 1 FROM lectures l2 WHERE l2.educator_id = e.id AND l2.subject LIKE ?)'
            params.append(f'%{subject}%')

        sql += ' GROUP BY e.id ORDER BY e.rating DESC'

        cursor.execute(sql, params)
        educators = cursor.fetchall()
        conn.close()
        return [dict(educator) for educator in educators]

    @staticmethod
    def update_educator(educator_id: int, **kwargs) -> bool:
        """Update educator profile."""
        if not kwargs:
            return True

        conn = get_db_connection()
        cursor = conn.cursor()

        fields = []
        values = []
        for key, value in kwargs.items():
            if key in ['title', 'department', 'institution', 'bio', 'specializations', 'credentials']:
                fields.append(f"{key} = ?")
                values.append(value)

        if not fields:
            conn.close()
            return True

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(educator_id)

        sql = f"UPDATE educators SET {', '.join(fields)} WHERE id = ?"
        cursor.execute(sql, values)

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

class LectureDB:
    """Lecture database operations."""

    @staticmethod
    def create_lecture(educator_id: int, title: str, subject: str, description: str = None,
                      lecture_type: str = 'video', difficulty_level: str = 'intermediate') -> Optional[int]:
        """Create a new lecture."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO lectures (educator_id, title, subject, description, lecture_type, difficulty_level)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (educator_id, title, subject, description, lecture_type, difficulty_level))

            lecture_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return lecture_id
        except sqlite3.Error:
            conn.close()
            return None

    @staticmethod
    def get_educator_lectures(educator_id: int) -> List[Dict]:
        """Get all lectures for an educator."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT l.*,
                   COUNT(si.id) as question_count,
                   AVG(si.satisfaction_rating) as avg_satisfaction
            FROM lectures l
            LEFT JOIN student_interactions si ON l.id = si.lecture_id
            WHERE l.educator_id = ?
            GROUP BY l.id
            ORDER BY l.created_at DESC
        ''', (educator_id,))

        lectures = cursor.fetchall()
        conn.close()
        return [dict(lecture) for lecture in lectures]

    @staticmethod
    def get_public_lectures(subject: str = None, limit: int = 20) -> List[Dict]:
        """Get public lectures, optionally filtered by subject."""
        conn = get_db_connection()
        cursor = conn.cursor()

        if subject:
            cursor.execute('''
                SELECT l.*, e.title as educator_title, u.username as educator_name,
                       e.institution, e.rating as educator_rating
                FROM lectures l
                JOIN educators e ON l.educator_id = e.id
                JOIN users u ON e.user_id = u.id
                WHERE l.is_public = 1 AND l.subject LIKE ?
                ORDER BY l.view_count DESC, l.created_at DESC
                LIMIT ?
            ''', (f'%{subject}%', limit))
        else:
            cursor.execute('''
                SELECT l.*, e.title as educator_title, u.username as educator_name,
                       e.institution, e.rating as educator_rating
                FROM lectures l
                JOIN educators e ON l.educator_id = e.id
                JOIN users u ON e.user_id = u.id
                WHERE l.is_public = 1
                ORDER BY l.view_count DESC, l.created_at DESC
                LIMIT ?
            ''', (limit,))

        lectures = cursor.fetchall()
        conn.close()
        return [dict(lecture) for lecture in lectures]

    @staticmethod
    def get_lecture_by_id(lecture_id: int) -> Optional[Dict]:
        """Get lecture by ID with educator info."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT l.*, e.title as educator_title, u.username as educator_name,
                   e.institution, e.bio as educator_bio
            FROM lectures l
            JOIN educators e ON l.educator_id = e.id
            JOIN users u ON e.user_id = u.id
            WHERE l.id = ?
        ''', (lecture_id,))

        lecture = cursor.fetchone()
        conn.close()
        return dict(lecture) if lecture else None

    @staticmethod
    def update_processing_status(lecture_id: int, status: str, chroma_collection_id: str = None) -> bool:
        """Update lecture processing status."""
        conn = get_db_connection()
        cursor = conn.cursor()

        if chroma_collection_id:
            cursor.execute('''
                UPDATE lectures
                SET processing_status = ?, chroma_collection_id = ?, is_processed = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (status, chroma_collection_id, status == 'completed', lecture_id))
        else:
            cursor.execute('''
                UPDATE lectures
                SET processing_status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (status, lecture_id))

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

class StudentInteractionDB:
    """Student interaction database operations."""

    @staticmethod
    def log_interaction(student_id: int, educator_id: int, lecture_id: int, session_id: str,
                       question: str, ai_response: str, context_used: str = None,
                       response_type: str = 'direct', response_time_ms: int = None) -> Optional[int]:
        """Log a student interaction."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO student_interactions
                (student_id, educator_id, lecture_id, session_id, question, ai_response,
                 context_used, response_type, response_time_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (student_id, educator_id, lecture_id, session_id, question, ai_response,
                  context_used, response_type, response_time_ms))

            interaction_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return interaction_id
        except sqlite3.Error:
            conn.close()
            return None

    @staticmethod
    def get_student_history(student_id: int, educator_id: int = None) -> List[Dict]:
        """Get student interaction history."""
        conn = get_db_connection()
        cursor = conn.cursor()

        if educator_id:
            cursor.execute('''
                SELECT si.*, l.title as lecture_title, u.username as educator_name
                FROM student_interactions si
                LEFT JOIN lectures l ON si.lecture_id = l.id
                LEFT JOIN educators e ON si.educator_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE si.student_id = ? AND si.educator_id = ?
                ORDER BY si.created_at DESC
                LIMIT 50
            ''', (student_id, educator_id))
        else:
            cursor.execute('''
                SELECT si.*, l.title as lecture_title, u.username as educator_name
                FROM student_interactions si
                LEFT JOIN lectures l ON si.lecture_id = l.id
                LEFT JOIN educators e ON si.educator_id = e.id
                LEFT JOIN users u ON e.user_id = u.id
                WHERE si.student_id = ?
                ORDER BY si.created_at DESC
                LIMIT 50
            ''', (student_id,))

        interactions = cursor.fetchall()
        conn.close()
        return [dict(interaction) for interaction in interactions]

# Initialize educational database on import
init_education_database()