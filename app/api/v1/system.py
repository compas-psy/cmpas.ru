"""
System endpoints for cmpas.ru API v1.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import (
    User,
    LoginAudit,
    UserConsent,
    UserConsentLog,
    ConsentDocument,
)
from app.config import settings

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/ping", summary="API v1 health check")
async def ping() -> dict[str, str]:
    """Return simple status payload for monitoring."""
    return {"status": "ok"}


@router.get(
    "/debug/user",
    summary="Debug: get user info and logs by email",
    response_model=dict,
)
async def debug_user(
    email: str = Query(..., description="Email to inspect"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        return {
            "user": None,
            "login_audit": [],
            "consents": {"current": [], "logs": []},
        }

    # Login audit entries
    la_res = await db.execute(
        select(LoginAudit).where(LoginAudit.user_id == user.id).order_by(LoginAudit.timestamp.desc())
    )
    audits = la_res.scalars().all()

    # Consents current state
    uc_res = await db.execute(select(UserConsent).where(UserConsent.user_id == user.id))
    consents = uc_res.scalars().all()

    # Consents history
    ucl_res = await db.execute(
        select(UserConsentLog).where(UserConsentLog.user_id == user.id).order_by(UserConsentLog.timestamp.desc())
    )
    consent_logs = ucl_res.scalars().all()

    def iso(dt):
        return dt.isoformat() if dt else None

    user_payload = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "telegram_id": user.telegram_id,
        "yandex_id": user.yandex_id,
        "full_name": user.full_name,
        "role": getattr(user.role, "name", str(user.role)) if user.role is not None else None,
        "auth_provider": getattr(user.auth_provider, "name", str(user.auth_provider)) if user.auth_provider is not None else None,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": iso(getattr(user, "created_at", None)),
        "updated_at": iso(getattr(user, "updated_at", None)),
        "last_login": iso(getattr(user, "last_login", None)),
    }

    audits_payload = [
        {
            "id": a.id,
            "timestamp": iso(getattr(a, "timestamp", None)),
            "path": a.path,
            "provider": getattr(a.provider, "name", str(a.provider)) if a.provider is not None else None,
            "ip_address": a.ip_address,
            "user_agent": a.user_agent,
            "device_type": a.device_type,
            "browser": a.browser,
            "os": a.os,
            "referer": a.referer,
            "accept_language": a.accept_language,
            "success": a.success,
            "error": a.error,
        }
        for a in audits
    ]

    consents_payload = [
        {
            "id": c.id,
            "type": getattr(c.type, "name", str(c.type)) if c.type is not None else None,
            "accepted": c.accepted,
            "document_id": c.document_id,
            "accepted_at": iso(getattr(c, "accepted_at", None)),
            "updated_at": iso(getattr(c, "updated_at", None)),
            "created_at": iso(getattr(c, "created_at", None)),
        }
        for c in consents
    ]

    consent_logs_payload = [
        {
            "id": cl.id,
            "type": getattr(cl.type, "name", str(cl.type)) if cl.type is not None else None,
            "action": getattr(cl.action, "name", str(cl.action)) if cl.action is not None else None,
            "document_id": cl.document_id,
            "document_version": cl.document_version,
            "document_url": cl.document_url,
            "timestamp": iso(getattr(cl, "timestamp", None)),
            "ip_address": cl.ip_address,
            "user_agent": cl.user_agent,
            "device_type": cl.device_type,
            "browser": cl.browser,
            "os": cl.os,
            "referer": cl.referer,
            "accept_language": cl.accept_language,
        }
        for cl in consent_logs
    ]

    return {
        "user": user_payload,
        "login_audit": audits_payload,
        "consents": {"current": consents_payload, "logs": consent_logs_payload},
    }


@router.get(
    "/ui-config",
    summary="Frontend UI configuration",
    response_model=dict,
)
async def ui_config() -> dict:
    """Return small UI config for the static frontend."""
    mode = (settings.YANDEX_BUTTON_MODE or "native").lower()
    if mode not in ("native", "custom"):
        mode = "native"
    return {
        "yandex_button_mode": mode,
        "app_main_url": settings.APP_MAIN_URL or "/",
    }
