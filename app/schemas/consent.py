"""Consent-related Pydantic schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.consent import ConsentType, ConsentAction


class ConsentActionRequest(BaseModel):
    """Request payload for accepting or withdrawing a consent."""
    document_id: Optional[int] = None


class ConsentDocumentCreate(BaseModel):
    """Admin: create a new consent document version."""
    type: ConsentType
    version: str
    url: str
    effective_from: Optional[datetime] = None


class ConsentDocumentOut(BaseModel):
    id: int
    type: ConsentType
    version: str
    url: str
    effective_from: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConsentStatus(BaseModel):
    """Current consent state for a user."""
    id: int
    type: ConsentType
    accepted: bool
    document_id: Optional[int]
    document_version: Optional[str]
    document_url: Optional[str]
    accepted_at: Optional[datetime]
    updated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsentLogEntry(BaseModel):
    """History entry for consent changes."""
    id: int
    type: ConsentType
    action: ConsentAction
    document_id: Optional[int]
    document_version: Optional[str]
    document_url: Optional[str]
    timestamp: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]
    device_type: Optional[str]
    browser: Optional[str]
    os: Optional[str]
    referer: Optional[str]
    accept_language: Optional[str]

    class Config:
        from_attributes = True
