"""
Authentication utilities for JWT token management and password hashing.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import UserDB, AdminDB

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24  # 30 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a JWT token and return the payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate a regular user."""
    user = UserDB.get_user_by_username(username)
    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    # Update last login
    UserDB.update_last_login(user["id"])

    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": "user"
    }

def authenticate_admin(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate an admin user."""
    admin = AdminDB.get_admin_by_username(username)
    if not admin:
        return None

    if not verify_password(password, admin["password_hash"]):
        return None

    # Update last login
    AdminDB.update_last_login(admin["id"])

    return {
        "id": admin["id"],
        "username": admin["username"],
        "email": admin["email"],
        "role": "admin",
        "permissions": admin["permissions"].split(",") if admin["permissions"] else []
    }

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    role: str = payload.get("role")

    if user_id is None or role is None:
        raise credentials_exception

    # Get user data from database
    if role == "user":
        user_data = UserDB.get_user_by_id(int(user_id))
        if user_data is None:
            raise credentials_exception
        return {
            "id": user_data["id"],
            "username": user_data["username"],
            "email": user_data["email"],
            "role": "user"
        }
    elif role == "admin":
        admin_data = AdminDB.get_admin_by_id(int(user_id))
        if admin_data is None:
            raise credentials_exception
        return {
            "id": admin_data["id"],
            "username": admin_data["username"],
            "email": admin_data["email"],
            "role": "admin",
            "permissions": admin_data["permissions"].split(",") if admin_data["permissions"] else []
        }
    elif role == "super_admin":
        # Super admin doesn't need database lookup
        return {
            "id": 0,
            "username": "super_admin",
            "email": "admin@system.local",
            "role": "super_admin"
        }
    else:
        raise credentials_exception

def get_current_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure current user is an admin."""
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def get_current_super_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Ensure current user is a super admin."""
    if current_user["role"] != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user

def verify_super_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Verify super admin token (original admin token system)."""
    SUPER_ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "velocity_admin_12345")

    if credentials.credentials == SUPER_ADMIN_TOKEN:
        return {
            "id": 0,
            "username": "super_admin",
            "email": "admin@system.local",
            "role": "super_admin"
        }

    # Try JWT token verification as fallback
    payload = verify_token(credentials.credentials)
    if payload and payload.get("role") == "super_admin":
        return {
            "id": 0,
            "username": "super_admin",
            "email": "admin@system.local",
            "role": "super_admin"
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid super admin credentials"
    )

def create_super_admin_token() -> str:
    """Create a JWT token for super admin."""
    token_data = {
        "sub": "0",
        "username": "super_admin",
        "role": "super_admin"
    }
    return create_access_token(token_data)

# Validation functions
def validate_username(username: str) -> bool:
    """Validate username format."""
    if len(username) < 3 or len(username) > 50:
        return False
    if not username.replace("_", "").replace("-", "").isalnum():
        return False
    return True

def validate_email(email: str) -> bool:
    """Basic email validation."""
    return "@" in email and "." in email.split("@")[-1] and len(email) >= 5

def validate_password(password: str) -> bool:
    """Validate password strength."""
    if len(password) < 6:
        return False
    return True