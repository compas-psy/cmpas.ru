"""System endpoints for cmpas.ru API v1."""

from fastapi import APIRouter

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/ping", summary="API v1 health check")
async def ping() -> dict[str, str]:
    """Return simple status payload for monitoring."""
    return {"status": "ok"}
