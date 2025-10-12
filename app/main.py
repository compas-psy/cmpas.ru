"""
Главный файл приложения FastAPI
Точка входа для uvicorn
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, close_db
from app.api import api_router
from app.core import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app import models as _models  # Ensure all SQLAlchemy models are imported and registered

# Настройка логирования
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Управление жизненным циклом приложения
    """
    # Startup
    logger.info("Запуск приложения cmpas.ru")
    await init_db()
    logger.info("База данных инициализирована")
    
    yield
    
    # Shutdown
    logger.info("Остановка приложения")
    await close_db()
    logger.info("Соединения с БД закрыты")


# Создаем приложение FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Платформа для специалистов помогающих профессий",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Настройка rate limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Монтируем статические файлы (если папка существует)
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except RuntimeError:
    logger.warning("Папка static не найдена")


@app.get("/", include_in_schema=False)
async def root():
    """
    Главная страница - отдаем index.html
    """
    return FileResponse("index.html")


@app.get("/auth", include_in_schema=False)
async def auth_page():
    """
    Страница авторизации — отдаём static/telegram_auth.html
    """
    return FileResponse("static/telegram_auth.html")


@app.get("/legal", include_in_schema=False)
async def legal_index() -> HTMLResponse:
    """
    Раздел с юридическими документами (PDF): политика, пользовательское соглашение, рекламное согласие.
    """
    html = """
    <!DOCTYPE html>
    <html lang=\"ru\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Юридическая информация — cmpas.ru</title>
      <style>
        body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; padding: 24px; line-height: 1.6; }
        h1 { font-size: 24px; margin-bottom: 16px; }
        ul { list-style: none; padding-left: 0; }
        li { margin: 8px 0; }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Юридическая информация</h1>
      <ul>
        <li><a href=\"/legal/privacy\">Политика конфиденциальности</a></li>
        <li><a href=\"/legal/terms\">Пользовательское соглашение</a></li>
      </ul>
    </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/legal/advertising", include_in_schema=False)
async def legal_advertising() -> HTMLResponse:
    """
    Публичная версия Согласия на рекламные/информационные материалы (временная HTML-заглушка).
    В проде заменить на статический документ/рендер шаблона и версионность.
    """
    html = """
    <!DOCTYPE html>
    <html lang=\"ru\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Согласие на рекламные материалы — cmpas.ru</title>
      <style> body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; padding: 24px; line-height: 1.6; } h1{font-size:24px;margin-bottom:16px;} </style>
    </head>
    <body>
      <h1>Согласие на рекламные и информационные материалы</h1>
      <p>Эта страница — временная заглушка согласия для целей MVP. Полная версия документа и его версия будут опубликованы позднее.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/legal/terms", include_in_schema=False)
async def legal_terms() -> HTMLResponse:
    """
    Публичная версия Пользовательского соглашения (временная HTML-заглушка).
    В проде заменить на статический документ/рендер шаблона и версионность.
    """
    html = """
    <!DOCTYPE html>
    <html lang=\"ru\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Пользовательское соглашение — cmpas.ru</title>
      <style> body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; padding: 24px; line-height: 1.6; } h1{font-size:24px;margin-bottom:16px;} </style>
    </head>
    <body>
      <h1>Пользовательское соглашение</h1>
      <p>Эта страница — временная заглушка Пользовательского соглашения для целей MVP. Полная версия документа и его версия будут опубликованы позднее.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/legal/privacy", include_in_schema=False)
async def legal_privacy() -> HTMLResponse:
    """
    Публичная версия Политики конфиденциальности (временная HTML-заглушка).
    В проде заменить на статический документ/рендер шаблона и версионность.
    """
    html = """
    <!DOCTYPE html>
    <html lang=\"ru\">
    <head>
      <meta charset=\"UTF-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
      <title>Политика конфиденциальности — cmpas.ru</title>
      <style> body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; padding: 24px; line-height: 1.6; } h1{font-size:24px;margin-bottom:16px;} </style>
    </head>
    <body>
      <h1>Политика конфиденциальности</h1>
      <p>Эта страница — временная заглушка Политики конфиденциальности для целей MVP. Полная версия документа и его версия будут опубликованы позднее.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=200)


@app.get("/health")
async def health_check():
    """
    Проверка здоровья приложения
    """
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/api/v1/info")
async def api_info():
    """
    Информация об API
    """
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "description": "API для платформы специалистов помогающих профессий",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health",
        }
    }


# Подключаем версионированные API роутеры
app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
