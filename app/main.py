"""
Главный файл приложения FastAPI
Точка входа для uvicorn
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import init_db, close_db

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


# TODO: Подключить роутеры когда они будут созданы
# from app.api import auth, users, appointments
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(appointments.router, prefix="/api/appointments", tags=["appointments"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
