"""Service functions for user consent management."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.consent import (
    ConsentType,
    ConsentDocument,
    UserConsent,
    UserConsentLog,
    ConsentAction,
)


async def _get_consent(
    db: AsyncSession,
    user_id: int,
    consent_type: ConsentType,
) -> Optional[UserConsent]:
    stmt = (
        select(UserConsent)
        .options(selectinload(UserConsent.document))
        .where(
            UserConsent.user_id == user_id,
            UserConsent.type == consent_type,
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def _get_document(
    db: AsyncSession,
    document_id: Optional[int],
    consent_type: ConsentType,
) -> Optional[ConsentDocument]:
    if document_id is None:
        return None
    document = await db.get(ConsentDocument, document_id)
    if document is None or document.type != consent_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid consent document")
    return document


def _build_status(consent: UserConsent) -> dict:
    document = consent.document
    return {
        "id": consent.id,
        "type": consent.type,
        "accepted": consent.accepted,
        "document_id": consent.document_id,
        "document_version": document.version if document else None,
        "document_url": document.url if document else None,
        "accepted_at": consent.accepted_at,
        "updated_at": consent.updated_at,
        "created_at": consent.created_at,
    }


def _build_log_entry(log: UserConsentLog) -> dict:
    return {
        "id": log.id,
        "type": log.type,
        "action": log.action,
        "document_id": log.document_id,
        "document_version": log.document_version,
        "document_url": log.document_url,
        "timestamp": log.timestamp,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "device_type": log.device_type,
        "browser": log.browser,
        "os": log.os,
        "referer": log.referer,
        "accept_language": log.accept_language,
    }


async def list_user_consents(db: AsyncSession, user_id: int) -> Sequence[dict]:
    stmt = (
        select(UserConsent)
        .options(selectinload(UserConsent.document))
        .where(UserConsent.user_id == user_id)
        .order_by(UserConsent.type)
    )
    result = await db.execute(stmt)
    consents = result.scalars().all()
    return [_build_status(consent) for consent in consents]


async def list_user_consent_logs(
    db: AsyncSession,
    user_id: int,
    consent_type: ConsentType,
) -> Sequence[dict]:
    stmt = (
        select(UserConsentLog)
        .options(selectinload(UserConsentLog.document))
        .where(
            UserConsentLog.user_id == user_id,
            UserConsentLog.type == consent_type,
        )
        .order_by(UserConsentLog.timestamp.desc())
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [_build_log_entry(log) for log in logs]


async def accept_consent(
    db: AsyncSession,
    *,
    user_id: int,
    consent_type: ConsentType,
    document_id: Optional[int],
    request_meta: dict,
) -> dict:
    document = await _get_document(db, document_id, consent_type)
    consent = await _get_consent(db, user_id, consent_type)
    now = datetime.now(timezone.utc)

    if consent is None:
        consent = UserConsent(
            user_id=user_id,
            type=consent_type,
        )
        db.add(consent)

    consent.accepted = True
    consent.document = document
    consent.accepted_at = now
    consent.updated_at = now

    log = UserConsentLog(
        user_id=user_id,
        type=consent_type,
        action=ConsentAction.ACCEPTED,
        document=document,
        document_version=document.version if document else None,
        document_url=document.url if document else None,
        timestamp=now,
        **request_meta,
    )
    db.add(log)

    return _build_status(consent)


async def create_consent_document(
    db: AsyncSession,
    *,
    consent_type: ConsentType,
    version: str,
    url: str,
    effective_from: datetime | None = None,
) -> dict:
    doc = ConsentDocument(
        type=consent_type,
        version=version,
        url=url,
        effective_from=effective_from,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return {
        "id": doc.id,
        "type": doc.type,
        "version": doc.version,
        "url": doc.url,
        "effective_from": doc.effective_from,
        "created_at": doc.created_at,
    }


async def list_consent_documents(
    db: AsyncSession,
    consent_type: ConsentType | None = None,
) -> Sequence[dict]:
    stmt = select(ConsentDocument)
    if consent_type is not None:
        stmt = stmt.where(ConsentDocument.type == consent_type)
    stmt = stmt.order_by(ConsentDocument.type, ConsentDocument.created_at.desc())
    res = await db.execute(stmt)
    docs = res.scalars().all()
    return [
        {
            "id": d.id,
            "type": d.type,
            "version": d.version,
            "url": d.url,
            "effective_from": d.effective_from,
            "created_at": d.created_at,
        }
        for d in docs
    ]


async def withdraw_consent(
    db: AsyncSession,
    *,
    user_id: int,
    consent_type: ConsentType,
    request_meta: dict,
) -> dict:
    consent = await _get_consent(db, user_id, consent_type)
    if consent is None or not consent.accepted:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Consent is not accepted")

    now = datetime.now(timezone.utc)
    consent.accepted = False
    consent.document = None
    consent.accepted_at = None
    consent.updated_at = now

    log = UserConsentLog(
        user_id=user_id,
        type=consent_type,
        action=ConsentAction.WITHDRAWN,
        document_id=None,
        document_version=None,
        document_url=None,
        timestamp=now,
        **request_meta,
    )
    db.add(log)

    return _build_status(consent)
