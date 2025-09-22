"""
Database models and utilities for user management.
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional, Dict, List, Any
import json

DATABASE_PATH = "./users.db"

def init_database():
    """Initialize the SQLite database with required tables."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # Users table (regular users)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    # Admins table (admin users)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            permissions TEXT DEFAULT 'upload,manage_docs',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    # Chat sessions table (chat history)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            conversation_id TEXT NOT NULL,
            messages TEXT NOT NULL,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Admin invite codes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invite_code TEXT UNIQUE NOT NULL,
            permissions TEXT DEFAULT 'upload,manage_docs',
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            used_by INTEGER NULL,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (created_by) REFERENCES admins (id),
            FOREIGN KEY (used_by) REFERENCES admins (id)
        )
    ''')

    conn.commit()
    conn.close()

def get_db_connection():
    """Get database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

class UserDB:
    """User database operations."""

    @staticmethod
    def create_user(username: str, email: str, password_hash: str) -> Optional[int]:
        """Create a new regular user."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (username, email, password_hash)
            )

            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return user_id
        except sqlite3.IntegrityError:
            conn.close()
            return None

    @staticmethod
    def get_user_by_username(username: str) -> Optional[Dict]:
        """Get user by username."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM users WHERE username = ? AND is_active = 1', (username,))
        user = cursor.fetchone()
        conn.close()

        return dict(user) if user else None

    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[Dict]:
        """Get user by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM users WHERE id = ? AND is_active = 1', (user_id,))
        user = cursor.fetchone()
        conn.close()

        return dict(user) if user else None

    @staticmethod
    def update_last_login(user_id: int):
        """Update user's last login timestamp."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            (user_id,)
        )

        conn.commit()
        conn.close()

    @staticmethod
    def get_all_users() -> List[Dict]:
        """Get all users for admin dashboard."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT id, username, email, created_at, last_login, is_active FROM users ORDER BY created_at DESC')
        users = cursor.fetchall()
        conn.close()

        return [dict(user) for user in users]

class AdminDB:
    """Admin database operations."""

    @staticmethod
    def create_admin(username: str, email: str, password_hash: str, permissions: str = 'upload,manage_docs') -> Optional[int]:
        """Create a new admin user."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                'INSERT INTO admins (username, email, password_hash, permissions) VALUES (?, ?, ?, ?)',
                (username, email, password_hash, permissions)
            )

            admin_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return admin_id
        except sqlite3.IntegrityError:
            conn.close()
            return None

    @staticmethod
    def get_admin_by_username(username: str) -> Optional[Dict]:
        """Get admin by username."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM admins WHERE username = ? AND is_active = 1', (username,))
        admin = cursor.fetchone()
        conn.close()

        return dict(admin) if admin else None

    @staticmethod
    def get_admin_by_id(admin_id: int) -> Optional[Dict]:
        """Get admin by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM admins WHERE id = ? AND is_active = 1', (admin_id,))
        admin = cursor.fetchone()
        conn.close()

        return dict(admin) if admin else None

    @staticmethod
    def update_last_login(admin_id: int):
        """Update admin's last login timestamp."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            (admin_id,)
        )

        conn.commit()
        conn.close()

    @staticmethod
    def get_all_admins() -> List[Dict]:
        """Get all admins for super admin dashboard."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT id, username, email, permissions, created_at, last_login, is_active FROM admins ORDER BY created_at DESC')
        admins = cursor.fetchall()
        conn.close()

        return [dict(admin) for admin in admins]

class ChatSessionDB:
    """Chat session database operations."""

    @staticmethod
    def save_chat_session(user_id: int, conversation_id: str, messages: List[Dict], title: str = None) -> Optional[int]:
        """Save or update a chat session."""
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if conversation exists
        cursor.execute(
            'SELECT id FROM chat_sessions WHERE user_id = ? AND conversation_id = ?',
            (user_id, conversation_id)
        )
        existing = cursor.fetchone()

        messages_json = json.dumps(messages)

        if existing:
            # Update existing conversation
            cursor.execute(
                'UPDATE chat_sessions SET messages = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (messages_json, title, existing['id'])
            )
            session_id = existing['id']
        else:
            # Create new conversation
            cursor.execute(
                'INSERT INTO chat_sessions (user_id, conversation_id, messages, title) VALUES (?, ?, ?, ?)',
                (user_id, conversation_id, messages_json, title)
            )
            session_id = cursor.lastrowid

        conn.commit()
        conn.close()
        return session_id

    @staticmethod
    def get_user_chat_sessions(user_id: int) -> List[Dict]:
        """Get all chat sessions for a user."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'SELECT id, conversation_id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
            (user_id,)
        )
        sessions = cursor.fetchall()
        conn.close()

        return [dict(session) for session in sessions]

    @staticmethod
    def get_chat_session(user_id: int, conversation_id: str) -> Optional[Dict]:
        """Get a specific chat session."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? AND conversation_id = ?',
            (user_id, conversation_id)
        )
        session = cursor.fetchone()
        conn.close()

        if session:
            result = dict(session)
            result['messages'] = json.loads(result['messages'])
            return result
        return None

    @staticmethod
    def delete_chat_session(user_id: int, conversation_id: str) -> bool:
        """Delete a chat session."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'DELETE FROM chat_sessions WHERE user_id = ? AND conversation_id = ?',
            (user_id, conversation_id)
        )

        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

class AdminInviteDB:
    """Admin invite codes database operations."""

    @staticmethod
    def create_invite(invite_code: str, permissions: str, created_by: int, expires_at: str) -> Optional[int]:
        """Create a new admin invite code."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                'INSERT INTO admin_invites (invite_code, permissions, created_by, expires_at) VALUES (?, ?, ?, ?)',
                (invite_code, permissions, created_by, expires_at)
            )

            invite_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return invite_id
        except sqlite3.IntegrityError:
            conn.close()
            return None

    @staticmethod
    def validate_invite(invite_code: str) -> Optional[Dict]:
        """Validate an invite code and return invite details if valid."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM admin_invites
            WHERE invite_code = ?
            AND is_active = 1
            AND used_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
        ''', (invite_code,))

        invite = cursor.fetchone()
        conn.close()

        return dict(invite) if invite else None

    @staticmethod
    def use_invite(invite_code: str, used_by: int) -> bool:
        """Mark an invite code as used."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'UPDATE admin_invites SET used_at = CURRENT_TIMESTAMP, used_by = ? WHERE invite_code = ?',
            (used_by, invite_code)
        )

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

    @staticmethod
    def get_all_invites() -> List[Dict]:
        """Get all invite codes for admin dashboard."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT ai.*, a.username as created_by_username, au.username as used_by_username
            FROM admin_invites ai
            LEFT JOIN admins a ON ai.created_by = a.id
            LEFT JOIN admins au ON ai.used_by = au.id
            ORDER BY ai.created_at DESC
        ''')

        invites = cursor.fetchall()
        conn.close()

        return [dict(invite) for invite in invites]

    @staticmethod
    def deactivate_invite(invite_code: str) -> bool:
        """Deactivate an invite code."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            'UPDATE admin_invites SET is_active = 0 WHERE invite_code = ?',
            (invite_code,)
        )

        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return success

# Initialize database on import
init_database()