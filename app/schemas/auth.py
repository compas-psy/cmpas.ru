"""
Pydantic схемы для аутентификации
"""

from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """Схема токена"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Данные из токена"""
    user_id: Optional[int] = None
    email: Optional[str] = None


class TelegramAuthRequest(BaseModel):
    """Запрос на аутентификацию через Telegram"""
    telegram_id: str
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class YandexAuthRequest(BaseModel):
    """Запрос на аутентификацию через Яндекс ID"""
    code: str
