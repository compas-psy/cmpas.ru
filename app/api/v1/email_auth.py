"""Email authentication endpoints."""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import LoginAudit, AuthProvider
from app.utils.request_meta import get_request_meta
from app.schemas.email_auth import EmailAuthRequest, EmailOTPVerifyRequest
from app.services.auth_service import initiate_email_login, verify_email_otp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/email", tags=["email_auth"])


@router.post(
    "/initiate",
    summary="Initiate email authentication",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def initiate_email_auth(payload: EmailAuthRequest) -> dict:
    """Start email OTP authentication flow: generate and send code."""
    identity = await initiate_email_login(payload.email)
    logger.info("Email auth initiated for %s", identity)
    return {"email": identity, "message": "OTP sent to your email"}


@router.post(
    "/verify",
    summary="Verify email OTP",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def verify_email_auth(
    raw_request: Request,
    request: EmailOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Complete email OTP authentication and return token pair."""
    try:
        result = await verify_email_otp(db=db, email=request.email, code=request.otp_code)
    except HTTPException as exc:
        # Login audit (failure)
        try:
            meta = get_request_meta(raw_request)
            audit = LoginAudit(
                user_id=None,
                provider=AuthProvider.EMAIL,
                path=str(raw_request.url.path),
                **meta,
                success=False,
                error=str(exc.detail) if hasattr(exc, "detail") else str(exc),
            )
            db.add(audit)
        except Exception:
            pass
        raise

    # Login audit (success)
    try:
        meta = get_request_meta(raw_request)
        audit = LoginAudit(
            user_id=result.get("user_id"),
            provider=AuthProvider.EMAIL,
            path=str(raw_request.url.path),
            **meta,
            success=True,
        )
        db.add(audit)
    except Exception:
        pass

    return result
