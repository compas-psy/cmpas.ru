"""
Login audit models to track authentication attempts.
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base
from app.models.user import AuthProvider
from sqlalchemy import Enum as SQLEnum


class LoginAudit(Base):
    __tablename__ = "login_audit"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    provider = Column(SQLEnum(AuthProvider), nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    path = Column(String, nullable=True)

    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_type = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    referer = Column(String, nullable=True)
    accept_language = Column(String, nullable=True)

    success = Column(Boolean, default=False, nullable=False)
    error = Column(String, nullable=True)
