"""Versioned API package."""

from app.api.v1.auth import router as auth_router
from app.api.v1.router import router
from app.api.v1.system import router as system_router

__all__ = ["router", "auth_router", "system_router"]
