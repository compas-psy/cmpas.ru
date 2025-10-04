"""Email service for sending OTP codes via SMTP."""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Simple SMTP email sender for OTP delivery."""

    def __init__(self) -> None:
        self.host: str = settings.SMTP_HOST
        self.port: int = settings.SMTP_PORT
        self.user: str = settings.SMTP_USER
        self.password: str = settings.SMTP_PASSWORD
        self.from_addr: str = settings.SMTP_FROM

    def _build_otp_message(self, to_addr: str, code: str) -> EmailMessage:
        msg = EmailMessage()
        msg["Subject"] = "Ваш код подтверждения cmpas.ru"
        msg["From"] = self.from_addr
        msg["To"] = to_addr
        msg.set_content(
            f"""
Здравствуйте!

Ваш одноразовый код подтверждения: {code}
Он действителен {settings.OTP_TTL_SECONDS // 60} минут(ы).
Никому не передавайте этот код.

С уважением,
Команда cmpas.ru
""".strip()
        )
        return msg

    def _send(self, to_addr: str, message: EmailMessage) -> None:
        with smtplib.SMTP(self.host, self.port, timeout=10) as server:
            server.starttls()
            if self.user and self.password:
                server.login(self.user, self.password)
            server.send_message(message)

    async def send_otp(self, to_addr: str, code: str) -> None:
        """Send OTP code to email. Falls back to logging if SMTP not configured."""
        if not self.host:
            logger.info("SMTP is not configured. OTP for %s: %s", to_addr, code)
            return

        msg = self._build_otp_message(to_addr, code)
        try:
            await asyncio.to_thread(self._send, to_addr, msg)
        except Exception as exc:  # pragma: no cover - external network
            logger.error("Failed to send OTP email to %s: %s", to_addr, exc)


email_service = EmailService()
