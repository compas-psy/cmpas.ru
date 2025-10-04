"""Telegram bot integration for delivering OTP codes."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

try:
    from telegram import Bot
except ImportError:  # pragma: no cover - handled during dependency install
    Bot = None  # type: ignore

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramService:
    """Wrapper around Telegram Bot API for sending OTP codes."""

    def __init__(self, token: str, username: str) -> None:
        self._token = token
        self._username = username
        self._bot: Optional[Bot] = None

        if token and Bot is not None:
            try:
                self._bot = Bot(token=self._token)
            except Exception as exc:  # pragma: no cover - network dependency
                logger.error("Failed to initialize Telegram bot: %s", exc)
                self._bot = None

    async def send_otp(self, chat_id: str, otp_code: str) -> None:
        """Send OTP code to provided Telegram chat.

        In development (when bot token missing) it falls back to logging only.
        """
        message = (
            "Ваш код подтверждения cmpas.ru: {code}\n"
            "Никому не передавайте этот код."
        ).format(code=otp_code)

        if not self._bot:
            logger.info(
                "Telegram bot token is not configured. OTP for %s: %s",
                chat_id,
                otp_code,
            )
            return

        try:  # pragma: no cover - external API
            await asyncio.to_thread(self._bot.send_message, chat_id=chat_id, text=message)
        except Exception as exc:
            logger.error("Failed to send OTP to Telegram user %s: %s", chat_id, exc)


telegram_service = TelegramService(
    token=settings.TELEGRAM_BOT_TOKEN,
    username=settings.TELEGRAM_BOT_USERNAME,
)
