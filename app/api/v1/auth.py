"""Authentication API endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from urllib.parse import urlencode
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import TelegramAuthRequest, TelegramOTPVerifyRequest, YandexAuthRequest
from app.services.auth_service import (
    initiate_telegram_login,
    verify_telegram_otp,
    yandex_oauth_service,
    get_or_create_or_update_yandex_user,
)
from app.config import settings
from app.utils.security import create_access_token, create_refresh_token

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


@router.get(
    "/yandex/callback",
    summary="Yandex OAuth callback",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def yandex_auth_callback(
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Обработка колбэка Яндекс ID. Обменивает code на токен, получает профиль, создает/обновляет пользователя."""
    # 1) Обмен кода на токены
    token_payload = await yandex_oauth_service.exchange_code(YandexAuthRequest(code=code))
    access_token = token_payload.get("access_token")
    if not access_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Yandex auth failed: no access_token")

    # 2) Получение профиля пользователя
    info = await yandex_oauth_service.fetch_userinfo(access_token)
    yandex_id = str(info.get("id")) if info.get("id") is not None else None
    if not yandex_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yandex user id is missing")

    # Попытаться собрать email
    email = info.get("default_email")
    if not email:
        emails = info.get("emails") or []
        email = emails[0] if emails else None

    # Попытаться собрать имя
    full_name = (
        info.get("real_name")
        or " ".join([x for x in [info.get("first_name"), info.get("last_name")] if x])
        or info.get("display_name")
        or info.get("login")
        or (email if email else yandex_id)
    )

    # 3) Создание/обновление пользователя и выпуск токенов
    user = await get_or_create_or_update_yandex_user(
        db=db,
        yandex_id=yandex_id,
        full_name=full_name,
        email=email,
    )

    access = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user_id": user.id,
        "yandex": {
            "id": yandex_id,
            "full_name": full_name,
            "email": email,
        },
        "state": state,
    }


@router.get(
    "/yandex/login",
    summary="Get Yandex OAuth authorization URL",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def yandex_login_url() -> dict:
    """Возвращает URL авторизации Яндекс ID (для клиентского редиректа)."""
    params = {
        "response_type": "code",
        "client_id": settings.YANDEX_CLIENT_ID,
        "redirect_uri": settings.YANDEX_REDIRECT_URI,
        "scope": settings.YANDEX_SCOPE,
    }
    url = f"{settings.YANDEX_AUTHORIZE_URL}?{urlencode(params)}"
    return {"authorize_url": url}


@router.get(
    "/yandex/authorize",
    include_in_schema=False,
)
async def yandex_authorize_redirect() -> RedirectResponse:
    """Прямой редирект на Яндекс (удобно вызывать из браузера)."""
    params = {
        "response_type": "code",
        "client_id": settings.YANDEX_CLIENT_ID,
        "redirect_uri": settings.YANDEX_REDIRECT_URI,
        "scope": settings.YANDEX_SCOPE,
    }
    url = f"{settings.YANDEX_AUTHORIZE_URL}?{urlencode(params)}"
    return RedirectResponse(url)
