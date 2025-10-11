"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.main import app
from app.database import AsyncSessionLocal, init_db
from app.models.user import User, AuthProvider, UserRole
from app.utils.security import create_refresh_token, create_access_token


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


async def _create_test_user() -> User:
    await init_db()
    async with AsyncSessionLocal() as session:
        await session.execute(delete(User))
        await session.commit()

    async with AsyncSessionLocal() as session:
        user = User(
            full_name="Test User",
            auth_provider=AuthProvider.YANDEX,
            role=UserRole.CLIENT,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest.mark.asyncio
async def test_auth_refresh_success():
    user = await _create_test_user()
    refresh_token = create_refresh_token({"sub": str(user.id)})

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"access_token", "refresh_token", "token_type"}
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_users_me_returns_current_user():
    user = await _create_test_user()
    access_token = create_access_token({"sub": str(user.id)})

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == user.id
    assert data["full_name"] == user.full_name
