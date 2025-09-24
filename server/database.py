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

    # Documents table for user-specific file ownership
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_by INTEGER NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_size INTEGER,
            file_path TEXT,
            chunks_count INTEGER DEFAULT 0,
            chroma_document_ids TEXT,
            FOREIGN KEY (uploaded_by) REFERENCES admins(id)
        )
    ''')

    # MCP Tools table for tool configurations
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mcp_tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tool_type TEXT NOT NULL,
            description TEXT,
            config_schema TEXT,
            is_enabled BOOLEAN DEFAULT 1,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES admins(id)
        )
    ''')

    # MCP Connections table for tool instances
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mcp_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            endpoint TEXT,
            config TEXT,
            credentials TEXT,
            status TEXT DEFAULT 'inactive',
            last_tested TIMESTAMP,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tool_id) REFERENCES mcp_tools(id),
            FOREIGN KEY (created_by) REFERENCES admins(id)
        )
    ''')

    # MCP Usage Logs table for tracking tool usage
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mcp_usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER NOT NULL,
            connection_id INTEGER,
            user_id INTEGER,
            query TEXT NOT NULL,
            response_summary TEXT,
            execution_time REAL,
            status TEXT NOT NULL,
            error_message TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tool_id) REFERENCES mcp_tools(id),
            FOREIGN KEY (connection_id) REFERENCES mcp_connections(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Tool Permissions table for role-based access
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tool_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            permission_type TEXT NOT NULL,
            is_allowed BOOLEAN DEFAULT 1,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tool_id) REFERENCES mcp_tools(id),
            FOREIGN KEY (created_by) REFERENCES admins(id)
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


class DocumentDB:
    """Document database operations for user-specific file management."""

    @staticmethod
    def create_document(filename: str, file_type: str, uploaded_by: int, file_path: str,
                       file_size: int, chunks_count: int = 0, chroma_document_ids: str = "") -> Optional[int]:
        """Create a new document record."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO documents (filename, file_type, uploaded_by, file_size, file_path, chunks_count, chroma_document_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (filename, file_type, uploaded_by, file_size, file_path, chunks_count, chroma_document_ids))

            document_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return document_id
        except sqlite3.Error as e:
            print(f"Error creating document: {e}")
            return None

    @staticmethod
    def get_user_documents(user_id: int) -> List[Dict[str, Any]]:
        """Get all documents for a specific user."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM documents
            WHERE uploaded_by = ?
            ORDER BY upload_date DESC
        ''', (user_id,))

        documents = cursor.fetchall()
        conn.close()

        return [dict(doc) for doc in documents]

    @staticmethod
    def get_all_documents() -> List[Dict[str, Any]]:
        """Get all documents (for super admin)."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT d.*, a.username as uploaded_by_username
            FROM documents d
            LEFT JOIN admins a ON d.uploaded_by = a.id
            ORDER BY d.upload_date DESC
        ''')

        documents = cursor.fetchall()
        conn.close()

        return [dict(doc) for doc in documents]

    @staticmethod
    def get_document_by_filename(filename: str, user_id: int = None) -> Optional[Dict[str, Any]]:
        """Get document by filename, optionally filtered by user."""
        conn = get_db_connection()
        cursor = conn.cursor()

        if user_id:
            cursor.execute('''
                SELECT * FROM documents
                WHERE filename = ? AND uploaded_by = ?
            ''', (filename, user_id))
        else:
            cursor.execute('''
                SELECT * FROM documents
                WHERE filename = ?
            ''', (filename,))

        document = cursor.fetchone()
        conn.close()

        return dict(document) if document else None

    @staticmethod
    def delete_document(filename: str, user_id: int) -> bool:
        """Delete a document if owned by user."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                DELETE FROM documents
                WHERE filename = ? AND uploaded_by = ?
            ''', (filename, user_id))

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error deleting document: {e}")
            return False

    @staticmethod
    def verify_ownership(filename: str, user_id: int) -> bool:
        """Verify if user owns the file."""
        document = DocumentDB.get_document_by_filename(filename, user_id)
        return document is not None

    @staticmethod
    def update_chunks_count(filename: str, user_id: int, chunks_count: int, chroma_ids: str) -> bool:
        """Update chunks count and ChromaDB IDs for a document."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE documents
                SET chunks_count = ?, chroma_document_ids = ?
                WHERE filename = ? AND uploaded_by = ?
            ''', (chunks_count, chroma_ids, filename, user_id))

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error updating document: {e}")
            return False


class MCPToolDB:
    """MCP tool database operations."""

    @staticmethod
    def create_tool(name: str, tool_type: str, description: str, config_schema: str, created_by: int) -> Optional[int]:
        """Create a new MCP tool."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO mcp_tools (name, tool_type, description, config_schema, created_by)
                VALUES (?, ?, ?, ?, ?)
            ''', (name, tool_type, description, config_schema, created_by))

            tool_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return tool_id
        except sqlite3.Error as e:
            print(f"Error creating MCP tool: {e}")
            return None

    @staticmethod
    def get_tool_by_id(tool_id: int) -> Optional[Dict[str, Any]]:
        """Get MCP tool by ID."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM mcp_tools WHERE id = ?', (tool_id,))
        tool = cursor.fetchone()
        conn.close()

        return dict(tool) if tool else None

    @staticmethod
    def get_all_tools() -> List[Dict[str, Any]]:
        """Get all MCP tools."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM mcp_tools ORDER BY name')
        tools = cursor.fetchall()
        conn.close()

        return [dict(tool) for tool in tools]

    @staticmethod
    def get_enabled_tools() -> List[Dict[str, Any]]:
        """Get all enabled MCP tools."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM mcp_tools WHERE is_enabled = 1 ORDER BY name')
        tools = cursor.fetchall()
        conn.close()

        return [dict(tool) for tool in tools]

    @staticmethod
    def update_tool_status(tool_id: int, is_enabled: bool) -> bool:
        """Enable or disable an MCP tool."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                UPDATE mcp_tools SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (is_enabled, tool_id))

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error updating tool status: {e}")
            return False


class MCPConnectionDB:
    """MCP connection database operations."""

    @staticmethod
    def create_connection(tool_id: int, name: str, endpoint: str, config: str, credentials: str, created_by: int) -> Optional[int]:
        """Create a new MCP connection."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO mcp_connections (tool_id, name, endpoint, config, credentials, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (tool_id, name, endpoint, config, credentials, created_by))

            connection_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return connection_id
        except sqlite3.Error as e:
            print(f"Error creating MCP connection: {e}")
            return None

    @staticmethod
    def get_connections_for_tool(tool_id: int) -> List[Dict[str, Any]]:
        """Get all connections for a specific tool."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT c.*, t.name as tool_name
            FROM mcp_connections c
            JOIN mcp_tools t ON c.tool_id = t.id
            WHERE c.tool_id = ?
            ORDER BY c.name
        ''', (tool_id,))

        connections = cursor.fetchall()
        conn.close()

        return [dict(conn) for conn in connections]

    @staticmethod
    def update_connection_status(connection_id: int, status: str, last_tested: str = None) -> bool:
        """Update connection status."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            if last_tested:
                cursor.execute('''
                    UPDATE mcp_connections
                    SET status = ?, last_tested = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (status, last_tested, connection_id))
            else:
                cursor.execute('''
                    UPDATE mcp_connections
                    SET status = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (status, connection_id))

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error updating connection status: {e}")
            return False

    @staticmethod
    def get_all_connections() -> List[Dict[str, Any]]:
        """Get all MCP connections (super admin view)."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT c.*, t.name as tool_name, t.tool_type,
                   a.username as created_by_username
            FROM mcp_connections c
            JOIN mcp_tools t ON c.tool_id = t.id
            LEFT JOIN admins a ON c.created_by = a.id
            ORDER BY c.created_at DESC
        ''')

        connections = cursor.fetchall()
        conn.close()

        return [dict(conn) for conn in connections]

    @staticmethod
    def get_connections_by_user(user_id: int) -> List[Dict[str, Any]]:
        """Get all connections created by a specific user/admin."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT c.*, t.name as tool_name, t.tool_type
            FROM mcp_connections c
            JOIN mcp_tools t ON c.tool_id = t.id
            WHERE c.created_by = ?
            ORDER BY c.created_at DESC
        ''', (user_id,))

        connections = cursor.fetchall()
        conn.close()

        return [dict(conn) for conn in connections]

    @staticmethod
    def delete_connection(connection_id: int) -> bool:
        """Delete an MCP connection."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('DELETE FROM mcp_connections WHERE id = ?', (connection_id,))

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error deleting connection: {e}")
            return False

    @staticmethod
    def update_connection(connection_id: int, name: str = None, endpoint: str = None,
                         config: str = None) -> bool:
        """Update an MCP connection."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            updates = []
            params = []

            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if endpoint is not None:
                updates.append("endpoint = ?")
                params.append(endpoint)
            if config is not None:
                updates.append("config = ?")
                params.append(config)

            if not updates:
                return True  # Nothing to update

            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(connection_id)

            query = f"UPDATE mcp_connections SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)

            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
        except sqlite3.Error as e:
            print(f"Error updating connection: {e}")
            return False


class MCPUsageLogDB:
    """MCP usage logging operations."""

    @staticmethod
    def log_usage(tool_id: int, connection_id: int, user_id: int, query: str,
                  response_summary: str, execution_time: float, status: str, error_message: str = None) -> Optional[int]:
        """Log MCP tool usage."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO mcp_usage_logs
                (tool_id, connection_id, user_id, query, response_summary, execution_time, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (tool_id, connection_id, user_id, query, response_summary, execution_time, status, error_message))

            log_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return log_id
        except sqlite3.Error as e:
            print(f"Error logging MCP usage: {e}")
            return None

    @staticmethod
    def get_usage_stats(tool_id: int = None, user_id: int = None, days: int = 30) -> List[Dict[str, Any]]:
        """Get usage statistics."""
        conn = get_db_connection()
        cursor = conn.cursor()

        query = '''
            SELECT l.*, t.name as tool_name, u.username
            FROM mcp_usage_logs l
            JOIN mcp_tools t ON l.tool_id = t.id
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.timestamp >= date('now', '-{} days')
        '''.format(days)

        params = []
        if tool_id:
            query += ' AND l.tool_id = ?'
            params.append(tool_id)
        if user_id:
            query += ' AND l.user_id = ?'
            params.append(user_id)

        query += ' ORDER BY l.timestamp DESC'

        cursor.execute(query, params)
        logs = cursor.fetchall()
        conn.close()

        return [dict(log) for log in logs]


class ToolPermissionDB:
    """Tool permission database operations."""

    @staticmethod
    def create_permission(tool_id: int, role: str, permission_type: str, is_allowed: bool, created_by: int) -> Optional[int]:
        """Create a tool permission."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO tool_permissions (tool_id, role, permission_type, is_allowed, created_by)
                VALUES (?, ?, ?, ?, ?)
            ''', (tool_id, role, permission_type, is_allowed, created_by))

            permission_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return permission_id
        except sqlite3.Error as e:
            print(f"Error creating tool permission: {e}")
            return None

    @staticmethod
    def check_permission(tool_id: int, role: str, permission_type: str) -> bool:
        """Check if role has permission for tool."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT is_allowed FROM tool_permissions
            WHERE tool_id = ? AND role = ? AND permission_type = ?
        ''', (tool_id, role, permission_type))

        result = cursor.fetchone()
        conn.close()

        return result['is_allowed'] if result else False

    @staticmethod
    def get_tool_permissions(tool_id: int) -> List[Dict[str, Any]]:
        """Get all permissions for a tool."""
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM tool_permissions
            WHERE tool_id = ?
            ORDER BY role, permission_type
        ''', (tool_id,))

        permissions = cursor.fetchall()
        conn.close()

        return [dict(perm) for perm in permissions]


# Initialize database on import
init_database()