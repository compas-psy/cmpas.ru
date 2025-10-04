"""One-time password generation and validation service."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict

from app.config import settings

logger = logging.getLogger(__name__)


class OTPError(Exception):
    """Base exception for OTP errors."""


class OTPNotFoundError(OTPError):
    """Raised when an OTP was not requested or already consumed."""


class OTPExpiredError(OTPError):
    """Raised when an OTP has expired."""


class OTPAttemptsExceededError(OTPError):
    """Raised when number of allowed attempts is exceeded."""


class OTPInvalidError(OTPError):
    """Raised when provided OTP code is invalid."""


@dataclass
class _OTPEntry:
    hash_value: str
    salt: str
    expires_at: datetime
    attempts: int = 0

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at


class OTPService:
    """Service responsible for creating and validating OTP codes."""

    def __init__(self, ttl_seconds: int, max_attempts: int, code_length: int) -> None:
        self._ttl = ttl_seconds
        self._max_attempts = max_attempts
        self._code_length = code_length
        self._storage: Dict[str, _OTPEntry] = {}
        self._lock = asyncio.Lock()

    async def generate_otp(self, identity: str) -> str:
        """Generate a fresh OTP for given identity and return plain code."""
        identity = str(identity).strip()
        if not identity:
            raise ValueError("identity must be provided")

        code = self._generate_code()
        salt = secrets.token_urlsafe(8)
        hashed = self._hash_code(code, salt)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self._ttl)

        async with self._lock:
            self._cleanup()
            self._storage[identity] = _OTPEntry(
                hash_value=hashed,
                salt=salt,
                expires_at=expires_at,
                attempts=0,
            )

        logger.debug("OTP generated for %s, expires at %s", identity, expires_at)
        return code

    async def validate_otp(self, identity: str, code: str) -> None:
        """Validate provided OTP code. Raises error when invalid."""
        identity = str(identity).strip()
        if not identity:
            raise ValueError("identity must be provided")

        async with self._lock:
            entry = self._storage.get(identity)
            if not entry:
                raise OTPNotFoundError("OTP was not requested or already used")

            if entry.is_expired():
                self._storage.pop(identity, None)
                raise OTPExpiredError("OTP has expired")

            if entry.attempts >= self._max_attempts:
                self._storage.pop(identity, None)
                raise OTPAttemptsExceededError("OTP attempts exceeded")

            hashed_input = self._hash_code(code, entry.salt)
            if not secrets.compare_digest(hashed_input, entry.hash_value):
                entry.attempts += 1
                if entry.attempts >= self._max_attempts:
                    self._storage.pop(identity, None)
                    raise OTPAttemptsExceededError("OTP attempts exceeded")
                raise OTPInvalidError("Invalid OTP code")

            # Successful validation — consume the OTP
            self._storage.pop(identity, None)
            logger.debug("OTP validated for %s", identity)

    def _generate_code(self) -> str:
        digits = "0123456789"
        return "".join(secrets.choice(digits) for _ in range(self._code_length))

    def _hash_code(self, code: str, salt: str) -> str:
        digest = hashlib.sha256()
        digest.update(f"{salt}:{code}".encode("utf-8"))
        return digest.hexdigest()

    def _cleanup(self) -> None:
        to_remove = [key for key, entry in self._storage.items() if entry.is_expired()]
        for key in to_remove:
            self._storage.pop(key, None)


otp_service = OTPService(
    ttl_seconds=settings.OTP_TTL_SECONDS,
    max_attempts=settings.OTP_MAX_ATTEMPTS,
    code_length=settings.OTP_CODE_LENGTH,
)
