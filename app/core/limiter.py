"""Rate limiting configuration using SlowAPI."""

from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

_default_limit = f"{settings.RATE_LIMIT_PER_MINUTE}/minute"

limiter = Limiter(key_func=get_remote_address, default_limits=[_default_limit])


def rate_limit_exceeded_handler(_: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return JSON response when rate limit is exceeded."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests",
            "error": str(exc),
            "limit": _default_limit,
        },
    )
