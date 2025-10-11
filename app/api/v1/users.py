"""User-related API endpoints."""

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user
from app.schemas.user import UserResponse
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user."""
    return current_user
