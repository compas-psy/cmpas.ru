"""
Базовые тесты для главного приложения
"""

import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    """Тест health check endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data


@pytest.mark.asyncio
async def test_api_info():
    """Тест API info endpoint"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/info")
    
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "cmpas.ru"
    assert "version" in data
    assert "endpoints" in data


@pytest.mark.asyncio
async def test_root():
    """Тест главной страницы"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
    
    # Должен вернуть HTML страницу
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
