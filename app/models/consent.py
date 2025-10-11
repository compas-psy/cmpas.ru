"""
User consent models to store advertising consent and accepted versions of legal documents.
"""
from __future__ import annotations

from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.database import Base


class ConsentType(str, enum.Enum):
    TERMS = "terms"                 # Пользовательское соглашение
    PRIVACY = "privacy"             # Политика конфиденциальности
    ADVERTISING = "advertising"     # Согласие на рекламу/рассылки


class ConsentDocument(Base):
    """Registry of consent/agreements versions with URLs.

    Keep a record of every published version and its effective date.
    """
    __tablename__ = "consent_documents"

    id = Column(Integer, primary_key=True)
    type = Column(SQLEnum(ConsentType), nullable=False, index=True)
    version = Column(String, nullable=False)  # e.g., "2025-10-01" or semantic
    url = Column(String, nullable=False)      # link to the public document
    effective_from = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    consents = relationship("UserConsent", back_populates="document")
    logs = relationship("UserConsentLog", back_populates="document")


class UserConsent(Base):
    """Current consent state per user and consent type.

    Contains only the latest accepted/withdrawn state and a pointer to the doc version.
    History is stored in UserConsentLog.
    """
    __tablename__ = "user_consents"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(ConsentType), nullable=False, index=True)

    accepted = Column(Boolean, default=False, nullable=False)
    document_id = Column(Integer, ForeignKey("consent_documents.id"), nullable=True)

    accepted_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("ConsentDocument", back_populates="consents")


class ConsentAction(str, enum.Enum):
    ACCEPTED = "accepted"
    WITHDRAWN = "withdrawn"
    UPDATED = "updated"


class UserConsentLog(Base):
    """History of user consent decisions across versions with request metadata."""
    __tablename__ = "user_consent_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(ConsentType), nullable=False, index=True)
    action = Column(SQLEnum(ConsentAction), nullable=False)

    document_id = Column(Integer, ForeignKey("consent_documents.id"), nullable=True)
    document_version = Column(String, nullable=True)
    document_url = Column(String, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    device_type = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    referer = Column(String, nullable=True)
    accept_language = Column(String, nullable=True)

    document = relationship("ConsentDocument", back_populates="logs")
