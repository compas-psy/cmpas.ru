"""Main API router for version 1 endpoints."""

from fastapi import APIRouter

from app.api.v1 import auth, system

router = APIRouter()
router.include_router(auth.router, tags=["auth"])
router.include_router(system.router, tags=["system"])
