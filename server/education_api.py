"""
Educational AI Clone Platform API endpoints.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
import json
from datetime import datetime

# Educational imports
from education_auth import (
    get_current_user_with_role, get_current_educator, get_current_student,
    format_educator_response, format_lecture_response, UserRole, PermissionChecker
)
from education_database import EducatorDB, LectureDB, StudentInteractionDB
from lecture_processor import lecture_processor, EducationalAI
from auth import get_password_hash, create_access_token, validate_username, validate_email, validate_password
from database import UserDB

# Create router for educational endpoints
education_router = APIRouter(prefix="/education", tags=["education"])

# Pydantic models for requests/responses
class EducatorRegistration(BaseModel):
    username: str
    email: str
    password: str
    title: str = "Professor"
    department: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None
    specializations: List[str] = []
    credentials: List[str] = []

class EducatorProfileUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    institution: Optional[str] = None
    bio: Optional[str] = None
    specializations: Optional[List[str]] = None
    credentials: Optional[List[str]] = None

class LectureCreate(BaseModel):
    title: str
    subject: str
    description: Optional[str] = None
    topic_tags: List[str] = []
    difficulty_level: str = "intermediate"
    prerequisite_topics: List[str] = []
    learning_objectives: List[str] = []
    is_public: bool = True

class StudentQuestion(BaseModel):
    question: str
    lecture_id: int
    session_id: str

class LectureSearch(BaseModel):
    query: Optional[str] = None
    subject: Optional[str] = None
    difficulty_level: Optional[str] = None
    educator_id: Optional[int] = None

# Authentication endpoints
@education_router.post("/auth/register-educator", response_model=Dict[str, Any])
async def register_educator(registration: EducatorRegistration):
    """Register a new educator."""
    # Validate input
    if not validate_username(registration.username):
        raise HTTPException(status_code=400, detail="Invalid username format")

    if not validate_email(registration.email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    if not validate_password(registration.password):
        raise HTTPException(status_code=400, detail="Password too weak")

    # Check if user already exists
    if UserDB.get_user_by_username(registration.username):
        raise HTTPException(status_code=400, detail="Username already exists")

    try:
        # Create user account
        password_hash = get_password_hash(registration.password)
        user_id = UserDB.create_user(registration.username, registration.email, password_hash)

        if not user_id:
            raise HTTPException(status_code=400, detail="Failed to create user account")

        # Create educator profile
        educator_id = EducatorDB.create_educator(
            user_id=user_id,
            title=registration.title,
            department=registration.department,
            institution=registration.institution,
            bio=registration.bio
        )

        if not educator_id:
            raise HTTPException(status_code=400, detail="Failed to create educator profile")

        # Update educator with additional fields
        if registration.specializations or registration.credentials:
            EducatorDB.update_educator(
                educator_id,
                specializations=json.dumps(registration.specializations),
                credentials=json.dumps(registration.credentials)
            )

        # Create access token
        from education_auth import create_educator_token
        access_token = create_educator_token(user_id, educator_id)

        # Get educator profile for response
        educator_profile = EducatorDB.get_educator_by_user_id(user_id)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": format_educator_response(educator_profile),
            "role": UserRole.EDUCATOR
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@education_router.post("/auth/convert-to-educator", response_model=Dict[str, Any])
async def convert_to_educator(
    profile_data: EducatorProfileUpdate,
    current_user: Dict = Depends(get_current_user_with_role)
):
    """Convert existing user to educator."""
    try:
        # Check if user is already an educator
        existing_educator = EducatorDB.get_educator_by_user_id(current_user['user_id'])
        if existing_educator:
            return {
                "access_token": create_educator_token(current_user['user_id'], existing_educator['id']),
                "token_type": "bearer",
                "user": format_educator_response(existing_educator),
                "role": UserRole.EDUCATOR
            }

        # Create educator profile for existing user
        educator_id = EducatorDB.create_educator(
            user_id=current_user['user_id'],
            title=profile_data.title or "Professor",
            department=profile_data.department,
            institution=profile_data.institution,
            bio=profile_data.bio
        )

        if not educator_id:
            raise HTTPException(status_code=400, detail="Failed to create educator profile")

        # Update educator with additional fields
        if profile_data.specializations or profile_data.credentials:
            import json
            update_dict = {}
            if profile_data.specializations:
                update_dict['specializations'] = json.dumps(profile_data.specializations)
            if profile_data.credentials:
                update_dict['credentials'] = json.dumps(profile_data.credentials)

            EducatorDB.update_educator(educator_id, **update_dict)

        # Create educator token
        access_token = create_educator_token(current_user['user_id'], educator_id)

        # Get educator profile for response
        educator_profile = EducatorDB.get_educator_by_user_id(current_user['user_id'])

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": format_educator_response(educator_profile),
            "role": UserRole.EDUCATOR
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

# Educator endpoints
@education_router.get("/educators", response_model=List[Dict[str, Any]])
async def get_educators(
    limit: int = 20,
    offset: int = 0,
    current_user: Dict = Depends(get_current_user_with_role)
):
    """Get list of educators."""
    educators = EducatorDB.get_all_educators(limit=limit, offset=offset)
    return [format_educator_response(educator) for educator in educators]

@education_router.get("/educators/search", response_model=List[Dict[str, Any]])
async def search_educators(
    query: str,
    subject: Optional[str] = None,
    current_user: Dict = Depends(get_current_user_with_role)
):
    """Search educators by name, institution, or specialization."""
    educators = EducatorDB.search_educators(query, subject)
    return [format_educator_response(educator) for educator in educators]

@education_router.get("/educators/me", response_model=Dict[str, Any])
async def get_my_profile(current_educator: Dict = Depends(get_current_educator)):
    """Get current educator's profile."""
    return format_educator_response(current_educator['educator_profile'])

@education_router.put("/educators/me", response_model=Dict[str, Any])
async def update_my_profile(
    update_data: EducatorProfileUpdate,
    current_educator: Dict = Depends(get_current_educator)
):
    """Update current educator's profile."""
    update_dict = update_data.dict(exclude_unset=True)

    # Convert lists to JSON strings for database storage
    if 'specializations' in update_dict:
        update_dict['specializations'] = json.dumps(update_dict['specializations'])
    if 'credentials' in update_dict:
        update_dict['credentials'] = json.dumps(update_dict['credentials'])

    success = EducatorDB.update_educator(current_educator['educator_id'], **update_dict)

    if not success:
        raise HTTPException(status_code=400, detail="Failed to update profile")

    # Return updated profile
    updated_profile = EducatorDB.get_educator_by_user_id(current_educator['user_id'])
    return format_educator_response(updated_profile)

# Lecture endpoints
@education_router.post("/lectures", response_model=Dict[str, Any])
async def create_lecture(
    lecture_data: LectureCreate,
    current_educator: Dict = Depends(get_current_educator)
):
    """Create a new lecture."""
    lecture_id = LectureDB.create_lecture(
        educator_id=current_educator['educator_id'],
        title=lecture_data.title,
        subject=lecture_data.subject,
        description=lecture_data.description,
        difficulty_level=lecture_data.difficulty_level
    )

    if not lecture_id:
        raise HTTPException(status_code=400, detail="Failed to create lecture")

    # Update lecture with additional fields
    lecture = LectureDB.get_lecture_by_id(lecture_id)
    return format_lecture_response(lecture)

@education_router.post("/lectures/{lecture_id}/upload")
async def upload_lecture_content(
    lecture_id: int,
    file: UploadFile = File(...),
    current_educator: Dict = Depends(get_current_educator)
):
    """Upload content for a lecture."""
    # Verify lecture ownership
    lecture = LectureDB.get_lecture_by_id(lecture_id)
    if not lecture or lecture['educator_id'] != current_educator['educator_id']:
        raise HTTPException(status_code=404, detail="Lecture not found")

    try:
        # Read file content
        file_content = await file.read()

        # Process the lecture content
        result = await lecture_processor.process_lecture_upload(
            file_content, file.filename, lecture_id, current_educator['educator_id']
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return {
            "message": "Lecture content uploaded and processing started",
            "processing_status": "processing",
            "lecture_id": lecture_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@education_router.get("/lectures/my", response_model=List[Dict[str, Any]])
async def get_my_lectures(current_educator: Dict = Depends(get_current_educator)):
    """Get current educator's lectures."""
    lectures = LectureDB.get_educator_lectures(current_educator['educator_id'])
    return [format_lecture_response(lecture) for lecture in lectures]

@education_router.get("/lectures/public", response_model=List[Dict[str, Any]])
async def get_public_lectures(
    subject: Optional[str] = None,
    limit: int = 20,
    current_user: Dict = Depends(get_current_user_with_role)
):
    """Get public lectures."""
    lectures = LectureDB.get_public_lectures(subject=subject, limit=limit)
    return [format_lecture_response(lecture) for lecture in lectures]

@education_router.get("/lectures/{lecture_id}", response_model=Dict[str, Any])
async def get_lecture(
    lecture_id: int,
    current_user: Dict = Depends(get_current_user_with_role)
):
    """Get lecture details."""
    lecture = LectureDB.get_lecture_by_id(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Check access permissions
    if not PermissionChecker.can_access_lecture(current_user, lecture):
        raise HTTPException(status_code=403, detail="Access denied")

    return format_lecture_response(lecture)

# Student interaction endpoints
@education_router.post("/ask", response_model=Dict[str, Any])
async def ask_question(
    question_data: StudentQuestion,
    current_student: Dict = Depends(get_current_student)
):
    """Ask a question about a lecture."""
    # Get lecture details
    lecture = LectureDB.get_lecture_by_id(question_data.lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Check if lecture content is processed
    if not lecture.get('is_processed'):
        return {
            "response": "I'm sorry, but this lecture content is still being processed. Please try again in a few minutes.",
            "status": "processing"
        }

    try:
        # Initialize educational AI
        educational_ai = EducationalAI()

        # Generate AI response
        ai_result = await educational_ai.generate_response(
            question=question_data.question,
            lecture_id=question_data.lecture_id,
            educator_id=lecture['educator_id']
        )

        if "error" in ai_result:
            raise HTTPException(status_code=500, detail=ai_result["error"])

        # Log the interaction
        interaction_id = StudentInteractionDB.log_interaction(
            student_id=current_student['user_id'],
            educator_id=lecture['educator_id'],
            lecture_id=question_data.lecture_id,
            session_id=question_data.session_id,
            question=question_data.question,
            ai_response=ai_result['response'],
            context_used=ai_result.get('context_used')
        )

        return {
            "response": ai_result['response'],
            "interaction_id": interaction_id,
            "lecture_title": lecture['title'],
            "educator_name": lecture['educator_name'],
            "confidence": ai_result.get('confidence', 0.0)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

@education_router.get("/interactions/history", response_model=List[Dict[str, Any]])
async def get_interaction_history(
    educator_id: Optional[int] = None,
    limit: int = 50,
    current_student: Dict = Depends(get_current_student)
):
    """Get student's interaction history."""
    interactions = StudentInteractionDB.get_student_history(
        current_student['user_id'], educator_id
    )
    return interactions[:limit]

# Practice problem endpoints
@education_router.post("/lectures/{lecture_id}/practice")
async def generate_practice_problem(
    lecture_id: int,
    topic: Optional[str] = None,
    difficulty: str = "intermediate",
    current_student: Dict = Depends(get_current_student)
):
    """Generate a practice problem for a lecture."""
    # Verify lecture access
    lecture = LectureDB.get_lecture_by_id(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if not PermissionChecker.can_access_lecture(current_student, lecture):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        educational_ai = EducationalAI()
        problem = await educational_ai.generate_practice_problem(
            lecture_id, topic or lecture['subject'], difficulty
        )
        return problem

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate practice problem: {str(e)}")

# Analytics endpoints (for educators)
@education_router.get("/analytics/my-lectures")
async def get_my_lecture_analytics(current_educator: Dict = Depends(get_current_educator)):
    """Get analytics for educator's lectures."""
    # Placeholder for analytics implementation
    return {
        "total_lectures": 0,
        "total_students": 0,
        "total_questions": 0,
        "average_rating": 0.0,
        "popular_topics": [],
        "recent_activity": []
    }

# Utility endpoints
@education_router.get("/subjects")
async def get_subjects(current_user: Dict = Depends(get_current_user_with_role)):
    """Get list of available subjects."""
    # This would typically come from the database
    return [
        "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
        "History", "Literature", "Philosophy", "Economics", "Psychology",
        "Engineering", "Medicine", "Law", "Art", "Music"
    ]

@education_router.get("/health")
async def health_check():
    """Health check endpoint for educational platform."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}