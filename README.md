# cmpas.ru — Платформа для специалистов помогающих профессий

**Проект для психологов, коучей, менторов и профориентаторов**

Платформа для управления клиентской базой, записи на приём, ведения дневника и коммуникации.

---

## Быстрый старт

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/cmpas.ru.git
cd cmpas.ru

# Установка зависимостей
pip install -r requirements.txt

# Настройка окружения (Linux/macOS)
cp .env.example .env

# Запуск сервера разработки
uvicorn app.main:app --reload
```

```powershell
# Windows PowerShell
git clone https://github.com/yourusername/cmpas.ru.git
Set-Location cmpas.ru
Copy-Item .env.example .env
python -m venv venv
./venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Сервер будет доступен по адресу: http://localhost:8000. Перед запуском тестов убедитесь, что `.env` создан и заполнен на основе `.env.example`.

## Текущий статус

**Версия:** 0.1.0 (MVP в разработке)

**Реализовано:**
- Базовая структура проекта
- FastAPI backend с базовым роутером `/api/v1/system/ping`
- Конфигурация окружения и rate limiting (SlowAPI)
- Аутентификация через Telegram OTP (инициация и верификация)

**В разработке:**
- Аутентификация через Яндекс ID
- Базовая структура БД
{{ ... }}

---

## Backlog

### Sprint 1: Аутентификация и безопасность
- Реализовать Telegram OTP аутентификацию
- Интегрировать Яндекс ID OAuth 2.0
- Создать middleware для проверки токенов
- Добавить rate limiting для защиты от брутфорса
- Реализовать логирование попыток входа

### Sprint 2: Юридическая обвязка
- Пользовательское соглашение
- Политика конфиденциальности
- Согласие на обработку персональных данных
- Согласие на рекламные рассылки
- API для принятия согласий

### Sprint 3: Профиль специалиста
- Создание и редактирование профиля
- Загрузка фото и документов
- Настройка расписания работы
- Управление услугами и ценами

### Sprint 4: Запись на приём
- Интеграция календаря (Google Calendar / Яндекс.Календарь)
- Система бронирования слотов
- Уведомления о записи (Telegram, Email)
- Отмена и перенос записей

### Sprint 5: Дневник специалиста
- Создание записей о сессиях
- Теги и категории
- Поиск по дневнику
- Экспорт данных

### Sprint 6: Telegram Mini App
- Адаптация UI для Telegram
- Интеграция с Telegram Bot API
- Push-уведомления через бота

### Sprint 7: Android App
- Разработка нативного приложения
- Синхронизация с backend
- Оффлайн режим

### Sprint 8: Tablet App
- Адаптация UI для планшетов
- Расширенные возможности для работы

---

## Архитектура

```
cmpas.ru/
├── app/
│   ├── __init__.py
│   ├── main.py                 # Точка входа FastAPI
│   ├── config.py               # Конфигурация из .env
│   ├── database.py             # Подключение к БД
│   ├── core/                   # Общие компоненты (лимитер и др.)
│   │   ├── __init__.py
│   │   └── limiter.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       └── system.py       # Системные эндпоинты (ping)
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── auth.py
│   ├── services/               # Бизнес-логика (планируется)
│   └── utils/
│       ├── __init__.py
│       └── security.py
├── tests/
│   ├── __init__.py
│   └── test_main.py
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── SECURITY.md
├── .env.example
├── requirements.txt
├── setup.sh
└── README.md
```

---

## Технологический стек

**Backend:**
- Python 3.10+
- FastAPI (async web framework)
- SQLAlchemy 2.0 (ORM)
- Alembic (миграции БД)
- Pydantic (валидация данных)

**База данных:**
- SQLite (development)
- PostgreSQL (production)

**Аутентификация:**
- OAuth 2.0
- JWT токены
- Telegram Bot API (OTP)
- Яндекс ID

**Инфраструктура:**
- Reg.ru (хостинг)
- GitHub (контроль версий)
- GitHub Actions (CI/CD)

---

## Безопасность

Проект следует принципам OWASP:
- Все пароли хешируются (bcrypt)
- OTP коды не хранятся в БД (только хеши с TTL)
- Секреты вынесены в `.env`
- Валидация всех входных данных
- Rate limiting на критичных endpoints
- HTTPS only в production
- CORS настроен корректно
- SQL injection защита через ORM

---

## Git Workflow

**Формат коммитов:**
```
feat: добавлена аутентификация через Telegram
fix: исправлена ошибка валидации email
docs: обновлена документация API
chore: обновлены зависимости
```

**Напоминание:** Коммитьте изменения регулярно (минимум раз в час при активной разработке).

---

## Тестирование

```bash
# Запуск всех тестов
pytest

# С покрытием кода
pytest --cov=app tests/

# Конкретный модуль
pytest tests/test_auth.py
```

---

## Документация

- **API документация:** http://localhost:8000/docs (Swagger UI)
- **ReDoc:** http://localhost:8000/redoc
- **Детальная документация:** см. папку `docs/`

---

## Контрибьюция

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'feat: add amazing feature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

---

## Лицензия

MIT License

---

## Автор

Разработано для специалистов помогающих профессий

---

## Поддержка

По вопросам и предложениям создавайте Issues в GitHub.
  - `C:\Users\eliah\CascadeProjects\hello-world\`
- Tell me if you want the text or styling changed. The current heading is exactly: `Hellow World@`.
