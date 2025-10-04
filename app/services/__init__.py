"""Service layer for cmpas.ru."""

from app.services.otp_service import OTPService, otp_service
from app.services.telegram_service import TelegramService, telegram_service
from app.services.auth_service import (
    get_or_create_telegram_user,
    get_or_create_or_update_yandex_user,
    YandexOAuthService,
)

__all__ = [
    "OTPService",
    "otp_service",
    "TelegramService",
    "telegram_service",
    "get_or_create_telegram_user",
    "get_or_create_or_update_yandex_user",
    "YandexOAuthService",
]
