"""Versioned API package."""

from app.api.v1.auth import router as auth_router
from app.api.v1.phone_auth import router as phone_auth_router
from app.api.v1.router import router
from app.api.v1.system import router as system_router
from app.api.v1.users import router as users_router

__all__ = [
    "router",
    "auth_router",
    "phone_auth_router",
    "system_router",
    "users_router",
]
