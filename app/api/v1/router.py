"""Main API router for version 1 endpoints."""

from fastapi import APIRouter

from app.api.v1 import auth, phone_auth, email_auth, system, users

router = APIRouter()
router.include_router(auth.router, tags=["auth"])
router.include_router(phone_auth.router, tags=["phone_auth"])
router.include_router(system.router, tags=["system"])
router.include_router(email_auth.router, tags=["email_auth"])
router.include_router(users.router, tags=["users"])
