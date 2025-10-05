"""Authentication services for cmpas.ru."""

from __future__ import annotations

import logging
from typing import Optional
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import AuthProvider, User, UserRole
from app.schemas.auth import TelegramAuthRequest, YandexAuthRequest
from app.services.otp_service import (
    OTPAttemptsExceededError,
    OTPExpiredError,
    OTPInvalidError,
    OTPNotFoundError,
    otp_service,
)
from app.services.telegram_service import telegram_service
from app.services.email_service import email_service
from app.utils.security import create_access_token, create_refresh_token

logger = logging.getLogger(__name__)


async def get_or_create_telegram_user(
    db: AsyncSession,
    telegram_id: str,
    full_name: str,
    username: Optional[str] = None,
) -> User:
    """Fetch existing Telegram user or create new one."""
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        user.full_name = full_name
        if username:
            user.email = user.email or None  # ensure attribute exists
        return user

    user = User(
        telegram_id=telegram_id,
        full_name=full_name,
        auth_provider=AuthProvider.TELEGRAM,
        role=UserRole.CLIENT,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def get_or_create_or_update_yandex_user(
    db: AsyncSession,
    yandex_id: str,
    full_name: str,
    email: Optional[str],
) -> User:
    """Fetch existing Yandex user or create new one."""
    stmt = select(User).where(User.yandex_id == yandex_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        user.full_name = full_name
        if email:
            user.email = email
        return user

    # If no user with given yandex_id, try to link by email to avoid UNIQUE(email) violation
    if email:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_by_email = result.scalar_one_or_none()
        if existing_by_email:
            existing_by_email.yandex_id = yandex_id
            existing_by_email.full_name = full_name
            existing_by_email.is_verified = True
            return existing_by_email

    user = User(
        yandex_id=yandex_id,
        full_name=full_name,
        email=email,
        auth_provider=AuthProvider.YANDEX,
        role=UserRole.CLIENT,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


class YandexOAuthService:
    """Service to exchange OAuth code for tokens and fetch user info."""

    def __init__(self) -> None:
        self._token_url = settings.YANDEX_TOKEN_URL
        self._userinfo_url = settings.YANDEX_USERINFO_URL

    async def exchange_code(self, request: YandexAuthRequest) -> dict:
        data = {
            "grant_type": "authorization_code",
            "code": request.code,
            "client_id": settings.YANDEX_CLIENT_ID,
            "client_secret": settings.YANDEX_CLIENT_SECRET,
            "redirect_uri": settings.YANDEX_REDIRECT_URI,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self._token_url, data=data)
            if response.status_code != 200:
                logger.error("Yandex token exchange failed: %s", response.text)
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Yandex auth failed")
            return response.json()

    async def fetch_userinfo(self, access_token: str) -> dict:
        headers = {"Authorization": f"OAuth {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self._userinfo_url, headers=headers)
            if response.status_code != 200:
                logger.error("Yandex userinfo request failed: %s", response.text)
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Failed to fetch Yandex user info")
            return response.json()


yandex_oauth_service = YandexOAuthService()


async def initiate_telegram_login(payload: TelegramAuthRequest) -> str:
    """Generate OTP and send to Telegram user. Returns request_id (telegram_id)."""
    otp_code = await otp_service.generate_otp(payload.telegram_id)
    await telegram_service.send_otp(payload.telegram_id, otp_code)
    return payload.telegram_id


async def verify_telegram_otp(
    db: AsyncSession,
    identity: str,
    code: str,
    full_name: str,
    username: Optional[str] = None,
) -> dict:
    """Validate Telegram OTP and return token pair."""
    try:
        await otp_service.validate_otp(identity, code)
    except OTPNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OTP не найден")
    except OTPExpiredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OTP истёк")
    except OTPAttemptsExceededError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Превышено число попыток")
    except OTPInvalidError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неверный OTP код")

    user = await get_or_create_telegram_user(db, identity, full_name, username)
    user.last_login = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id,
    }


async def initiate_email_login(email: str) -> str:
    """Generate OTP and send to the provided email. Returns identity (email)."""
    identity = email.strip().lower()
    code = await otp_service.generate_otp(identity)
    await email_service.send_otp(identity, code)
    return identity


async def get_or_create_email_user(db: AsyncSession, email: str) -> User:
    """Fetch existing user by email or create a new one with EMAIL provider."""
    identity = email.strip().lower()
    stmt = select(User).where(User.email == identity)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        return user

    user = User(
        email=identity,
        full_name=identity,
        auth_provider=AuthProvider.EMAIL,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def verify_email_otp(db: AsyncSession, email: str, code: str) -> dict:
    """Validate email OTP, create user if needed, and return token pair."""
    identity = email.strip().lower()
    try:
        await otp_service.validate_otp(identity, code)
    except OTPNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "OTP не найден")
    except OTPExpiredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OTP истёк")
    except OTPAttemptsExceededError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Превышено число попыток")
    except OTPInvalidError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неверный OTP код")

    user = await get_or_create_email_user(db, identity)
    user.last_login = datetime.now(timezone.utc)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": identity,
    }
