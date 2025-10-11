"""Phone number authentication endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.phone_auth import PhoneAuthRequest, PhoneOTPVerifyRequest, TelegramLoginData
from app.services.auth_service import (
    get_or_create_telegram_user,
    verify_telegram_otp,
)
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/phone", tags=["phone_auth"])


@router.post(
    "/initiate",
    summary="Initiate phone number authentication",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def initiate_phone_auth(
    request: Request,
    payload: PhoneAuthRequest,
) -> dict:
    """Start phone number OTP authentication flow."""
    # Здесь будет интеграция с Telegram Bot API для отправки OTP
    # Пока заглушка - в реальности нужно использовать Telegram API
    logger.info("Phone auth initiated for %s", payload.phone_number)
    return {
        "phone_number": payload.phone_number,
        "message": "OTP will be sent to your phone number",
        "note": "Integration with Telegram API needed"
    }


@router.post(
    "/verify",
    summary="Verify phone OTP",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def verify_phone_otp(
    request: Request,
    payload: PhoneOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Complete phone OTP authentication."""
    # Здесь будет верификация OTP кода
    # Пока заглушка для демонстрации flow
    logger.info("Phone OTP verification for %s", payload.phone_number)

    # В реальности здесь будет проверка OTP через Telegram API
    # Пока возвращаем mock токены для демонстрации
    return {
        "access_token": "mock_access_token",
        "refresh_token": "mock_refresh_token",
        "token_type": "bearer",
        "phone_number": payload.phone_number,
        "note": "Mock response - needs Telegram API integration"
    }


@router.post(
    "/telegram/callback",
    summary="Telegram Login Widget callback",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("5/minute")
async def telegram_login_callback(
    request: Request,
    login_data: TelegramLoginData,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Handle Telegram Login Widget authentication."""
    logger.info("Telegram login callback for user %s", login_data.id)

    # Валидация данных от Telegram (проверка hash)
    # Здесь должна быть валидация подписи от Telegram

    full_name = f"{login_data.first_name} {login_data.last_name}" if login_data.last_name else login_data.first_name

    user = await get_or_create_telegram_user(
        db=db,
        telegram_id=str(login_data.id),
        full_name=full_name,
        username=login_data.username,
    )

    # Генерация токенов (можно использовать существующие функции)
    from app.utils.security import create_access_token, create_refresh_token

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id,
        "telegram_data": {
            "id": login_data.id,
            "username": login_data.username,
            "full_name": full_name,
        }
    }
