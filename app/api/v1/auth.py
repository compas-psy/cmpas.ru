"""Authentication API endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import TelegramAuthRequest, TelegramOTPVerifyRequest
from app.services.auth_service import (
    initiate_telegram_login,
    verify_telegram_otp,
    yandex_oauth_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/telegram/initiate",
    summary="Initiate Telegram login",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def initiate_telegram_auth(
    payload: TelegramAuthRequest,
) -> dict:
    """Start Telegram OTP authentication flow."""
    request_id = await initiate_telegram_login(payload)
    return {"request_id": request_id, "message": "OTP sent to Telegram"}


@router.post(
    "/telegram/verify",
    summary="Verify Telegram OTP",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def verify_telegram_auth(
    request: TelegramOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Complete Telegram OTP authentication."""
    return await verify_telegram_otp(
        db=db,
        identity=request.telegram_id,
        code=request.otp_code,
        full_name=request.full_name,
        username=request.username,
    )


@router.post(
    "/yandex/callback",
    summary="Yandex OAuth callback",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def yandex_auth_callback(
    request: dict,  # TODO: add proper schema for callback
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle Yandex OAuth callback (placeholder for future implementation)."""
    # Placeholder - in real implementation, this would exchange code for tokens
    # and create/update user record
    return {"status": "not_implemented", "message": "Yandex auth not yet implemented"}
