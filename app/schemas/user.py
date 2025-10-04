"""
Pydantic схемы для пользователей
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

from app.models.user import UserRole, AuthProvider


class UserBase(BaseModel):
    """Базовая схема пользователя"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Схема для создания пользователя"""
    role: UserRole = UserRole.CLIENT
    auth_provider: AuthProvider
    telegram_id: Optional[str] = None
    yandex_id: Optional[str] = None


class UserUpdate(BaseModel):
    """Схема для обновления пользователя"""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)


class UserResponse(UserBase):
    """Схема ответа с данными пользователя"""
    id: int
    role: UserRole
    auth_provider: AuthProvider
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True
