"""
Education platform authentication extensions.
Extends the existing auth system with educator/student role management.
"""

from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from auth import security, SECRET_KEY, ALGORITHM
from database import UserDB
from education_database import EducatorDB
import json

# Educational role constants
class UserRole:
    STUDENT = "student"
    EDUCATOR = "educator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

async def get_current_user_with_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current user with educational role information."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        # Convert to int if it's a string (for compatibility with admin tokens)
        user_id: int = int(user_id_raw) if isinstance(user_id_raw, str) else user_id_raw
    except (JWTError, ValueError, TypeError):
        raise credentials_exception

    # Get user data
    user = UserDB.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception

    # Check if user is an educator
    educator_profile = EducatorDB.get_educator_by_user_id(user_id)

    # Determine user role - treat admin/super_admin as educators
    if educator_profile:
        role = UserRole.EDUCATOR
        user['educator_profile'] = educator_profile
        user['educator_id'] = educator_profile['id']
    elif user.get('role') in ['admin', 'super_admin']:
        # Admin users are treated as educators even without educator profile
        role = UserRole.EDUCATOR
        user['educator_profile'] = None
        user['educator_id'] = None
    else:
        role = UserRole.STUDENT

    user['role'] = role
    user['user_id'] = user_id

    return user

async def get_current_educator(current_user: Dict = Depends(get_current_user_with_role)) -> Dict[str, Any]:
    """Get current user if they are an educator."""
    if current_user.get('role') != UserRole.EDUCATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Educator access required"
        )
    return current_user

async def get_current_student(current_user: Dict = Depends(get_current_user_with_role)) -> Dict[str, Any]:
    """Get current user if they are a student."""
    if current_user.get('role') != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return current_user

def create_educator_token(user_id: int, educator_id: int) -> str:
    """Create JWT token with educator information."""
    from auth import create_access_token
    return create_access_token(data={"sub": user_id, "educator_id": educator_id, "role": UserRole.EDUCATOR})

def create_student_token(user_id: int) -> str:
    """Create JWT token for student."""
    from auth import create_access_token
    return create_access_token(data={"sub": user_id, "role": UserRole.STUDENT})

def parse_json_field(field_value: str, default: List = None) -> List:
    """Safely parse JSON field from database."""
    if not field_value:
        return default or []
    try:
        return json.loads(field_value)
    except (json.JSONDecodeError, TypeError):
        return default or []

def format_educator_response(educator_data: Dict) -> Dict[str, Any]:
    """Format educator data for API response."""
    if not educator_data:
        return {}

    # Parse JSON fields
    specializations = parse_json_field(educator_data.get('specializations'))
    credentials = parse_json_field(educator_data.get('credentials'))

    return {
        'id': educator_data.get('id'),
        'user_id': educator_data.get('user_id'),
        'username': educator_data.get('username'),
        'email': educator_data.get('email'),
        'title': educator_data.get('title'),
        'department': educator_data.get('department'),
        'institution': educator_data.get('institution'),
        'bio': educator_data.get('bio'),
        'specializations': specializations,
        'credentials': credentials,
        'experience_years': educator_data.get('experience_years', 0),
        'rating': educator_data.get('rating', 0.0),
        'total_ratings': educator_data.get('total_ratings', 0),
        'is_verified': bool(educator_data.get('is_verified', 0)),
        'lecture_count': educator_data.get('lecture_count', 0),
        'created_at': educator_data.get('created_at'),
    }

def format_lecture_response(lecture_data: Dict) -> Dict[str, Any]:
    """Format lecture data for API response."""
    if not lecture_data:
        return {}

    # Parse JSON fields
    topic_tags = parse_json_field(lecture_data.get('topic_tags'))
    prerequisite_topics = parse_json_field(lecture_data.get('prerequisite_topics'))
    learning_objectives = parse_json_field(lecture_data.get('learning_objectives'))

    return {
        'id': lecture_data.get('id'),
        'educator_id': lecture_data.get('educator_id'),
        'title': lecture_data.get('title'),
        'description': lecture_data.get('description'),
        'subject': lecture_data.get('subject'),
        'topic_tags': topic_tags,
        'lecture_type': lecture_data.get('lecture_type'),
        'duration_minutes': lecture_data.get('duration_minutes'),
        'difficulty_level': lecture_data.get('difficulty_level'),
        'prerequisite_topics': prerequisite_topics,
        'learning_objectives': learning_objectives,
        'is_processed': bool(lecture_data.get('is_processed', 0)),
        'processing_status': lecture_data.get('processing_status'),
        'view_count': lecture_data.get('view_count', 0),
        'is_public': bool(lecture_data.get('is_public', 1)),
        'question_count': lecture_data.get('question_count', 0),
        'avg_satisfaction': lecture_data.get('avg_satisfaction'),
        'educator_name': lecture_data.get('educator_name'),
        'educator_title': lecture_data.get('educator_title'),
        'institution': lecture_data.get('institution'),
        'educator_rating': lecture_data.get('educator_rating'),
        'created_at': lecture_data.get('created_at'),
        'updated_at': lecture_data.get('updated_at'),
    }

class PermissionChecker:
    """Helper class for checking educational platform permissions."""

    @staticmethod
    def can_access_lecture(user: Dict, lecture_data: Dict) -> bool:
        """Check if user can access a lecture."""
        # Public lectures are accessible to everyone
        if lecture_data.get('is_public'):
            return True

        # Educators can access their own lectures
        if user.get('role') == UserRole.EDUCATOR:
            return user.get('educator_id') == lecture_data.get('educator_id')

        return False

    @staticmethod
    def can_edit_lecture(user: Dict, lecture_data: Dict) -> bool:
        """Check if user can edit a lecture."""
        if user.get('role') != UserRole.EDUCATOR:
            return False

        return user.get('educator_id') == lecture_data.get('educator_id')

    @staticmethod
    def can_view_analytics(user: Dict, educator_id: int) -> bool:
        """Check if user can view educator analytics."""
        if user.get('role') != UserRole.EDUCATOR:
            return False

        return user.get('educator_id') == educator_id