"""
Модель пользователя
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    """Роли пользователей"""
    SPECIALIST = "specialist"  # Специалист (психолог, коуч и т.д.)
    CLIENT = "client"  # Клиент
    ADMIN = "admin"  # Администратор


class AuthProvider(str, enum.Enum):
    """Провайдеры аутентификации"""
    TELEGRAM = "telegram"
    YANDEX = "yandex"
    EMAIL = "email"  # На будущее


class User(Base):
    """
    Модель пользователя
    
    Attributes:
        id: Уникальный идентификатор
        email: Email пользователя (опционально)
        phone: Телефон пользователя (опционально)
        telegram_id: ID пользователя в Telegram
        yandex_id: ID пользователя в Яндекс
        full_name: Полное имя
        role: Роль пользователя
        auth_provider: Основной провайдер аутентификации
        is_active: Активен ли пользователь
        is_verified: Подтвержден ли пользователь
        created_at: Дата создания
        updated_at: Дата последнего обновления
        last_login: Дата последнего входа
    """
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Контактные данные
    email = Column(String, unique=True, nullable=True, index=True)
    phone = Column(String, unique=True, nullable=True, index=True)
    
    # ID от провайдеров OAuth
    telegram_id = Column(String, unique=True, nullable=True, index=True)
    yandex_id = Column(String, unique=True, nullable=True, index=True)
    
    # Личные данные
    full_name = Column(String, nullable=False)
    
    # Роль и статус
    role = Column(SQLEnum(UserRole), default=UserRole.CLIENT, nullable=False)
    auth_provider = Column(SQLEnum(AuthProvider), nullable=False)
    
    # Флаги
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Временные метки
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
