"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


@pytest.mark.asyncio
async def test_telegram_auth_initiate():
    """Test Telegram authentication initiation."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "telegram_id": "123456789",
            "first_name": "Иван",
            "last_name": "Иванов",
            "username": "ivan_ivanov",
            "auth_date": 1234567890,
            "hash": "abc123",
        }
        response = await client.post("/api/v1/auth/telegram/initiate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "request_id" in data
    assert data["message"] == "OTP sent to Telegram"


@pytest.mark.asyncio
async def test_system_ping():
    """Test system ping endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/system/ping")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
