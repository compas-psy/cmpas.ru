"""API router aggregation for cmpas.ru.

Exposes versioned API under /api/v1 and unversioned compatibility routes under /api.
"""

from fastapi import APIRouter

from app.api.v1.router import router as v1_router
from app.api.v1 import auth as auth_v1

api_router = APIRouter()

# Versioned routes
api_router.include_router(v1_router, prefix="/v1")

# Unversioned compatibility routes (e.g., /api/auth/yandex/callback)
api_router.include_router(auth_v1.router)

__all__ = ["api_router"]
