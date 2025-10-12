# CMPAS — Умные инструменты для специалистов помогающих профессий

**CMPAS (cmpas.ru)** — технологичный сервис-хелпер для психологов, коучей, менторов и других специалистов помогающих профессий.  
Фокус — снять рутину практики: запись на сессии, напоминания, согласия, анкеты и быстрая коммуникация.

> Минимум лишнего. Только то, что помогает вести практику.

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
python -m uvicorn app.main:app --reload
or do it with ssl like this:
.\venv\Scripts\uvicorn.exe app.main:app `
  --host localhost `
  --port 443 `
  --ssl-certfile .\localhost+2.pem `
  --ssl-keyfile .\localhost+2-key.pem

## 🚀 Почему CMPAS

В России много сервисов для поиска психологов, но почти нет — для самих специалистов.  
CMPAS — практичный набор «умных коротких действий» вместо тяжёлой CRM.

**Принципы:**
- Конфиденциальность и безопасность (152‑ФЗ, хранение в РФ, прозрачные согласия)
- Инструменты, а не маркетплейс
- Простота и производительность
- Telegram‑first взаимодействие (MiniApp/Inline в дорожной карте)
- Стадийное развитие от MVP к экосистеме

---

## ✅ Функции (MVP v0.1)

| Возможность | Статус |
|-------------|--------|
| Вход через Яндекс ID | ✅ Готово |
| Email OTP авторизация (в WebApp) | ✅ Готово |
| JWT/Refresh сессии | ✅ Готово |
| Rate limiting на auth и критичных эндпоинтах | ✅ Готово |
| База согласий и API для их фиксации | ✅ Готово |
| Слоты расписания и бронирование | ⏳ MVP этап |
| Напоминания через Telegram | ⏳ MVP этап |
| Подтверждение/перенос/отмена записи | ⏳ MVP этап |
| Шаблоны сообщений | ⏳ MVP этап |
| Intake анкеты клиентов | ⏳ MVP этап |
| Telegram Inline‑режим | ⏳ MVP этап |

Примечание: текущая страница аутентификации — `static/telegram_auth.html`, смонтирована как `/auth`. Юридические страницы доступны по `/legal/*`.

---

## 🛠 Текущий статус

**Версия:** 0.1.0 (MVP в активной разработке)  
Backend‑основа готова: авторизация (Яндекс ID и Email OTP), JWT/refresh, rate limiting, база согласий и API журнала. Следующий этап — расписание и бронирование.

---

## ✅ Roadmap CMPAS

- 🔹 Stage 0 — Основа (готово/заканчиваем)
  - Аутентификация (Yandex ID / Email OTP)
  - JWT/Refresh
  - Rate limiting + защита
  - Базовая страница авторизации (WebApp)
  - Логирование сессий
- 🔹 Stage 1 — Юридическая готовность и доверие
  - Журнал согласий (152‑ФЗ): версия, дата/время, IP/UA
  - Согласия клиента при бронировании
  - Хранение данных в РФ + политика конфиденциальности
  - Версионирование юридических текстов
- 🔹 Stage 2 — Запись как основа практики
  - Личное расписание специалиста
  - Слоты и правила генерации
  - Бронирование по защищённой ссылке `/b/:token`
  - Подтверждение / перенос / отмена
- 🔹 Stage 3 — Telegram Productivity
  - Уведомления 24ч/2ч
  - Inline Mode (@бот)
  - Быстрые команды «запись», «перенос», «слот»
  - Встроенный MiniApp
- 🔹 Stage 4 — Умные хелперы
  - Быстрые заметки (шифруемые поля)
  - Intake анкеты клиентов (короткие формы)
  - Шаблоны сообщений
  - Экспорт данных (.ics/.csv, позже PDF)

---

## ✅ Backlog (актуализированный под MVP)

- **Sprint A — Legal + Конфиденциальность**
  - API пользовательских согласий
  - Публичные страницы: Terms, Privacy (с версиями)
  - Журнал согласий (экспорт CSV/PDF — позже)
  - Обработка согласий клиента при записи (обязательные чекбоксы)
- **Sprint B — Запись и расписание**
  - Генератор расписания специалиста
  - Управление услугами (длительность, формат)
  - Слоты + API `/api/v1/slots`
  - Бронирование слотов `/b/:token`
  - ICS экспорт событий
- **Sprint C — Telegram Productivity**
  - Подключение рабочего Telegram‑бота
  - Уведомления 24ч/2ч перед сессией
  - Inline‑режим: запись и перенос
  - MiniActions (быстрые кнопки)

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
│   │   ├── deps.py             # Зависимости FastAPI (JWT-пользователь)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py
│   │       ├── auth.py         # Аутентификация: Яндекс ID + Email OTP + refresh
│   │       ├── phone_auth.py   # Телефонная аутентификация
│   │       ├── system.py       # Системные эндпоинты (ping)
│   │       └── users.py        # Текущий пользователь (/users/me)
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── phone_auth.py
│   │   └── user.py
│   ├── services/               # Бизнес-логика
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── otp_service.py
│   │   └── telegram_service.py
│   └── utils/
│       ├── __init__.py
│       └── security.py
├── static/                     # Статические файлы
│   └── telegram_auth.html      # Страница авторизации (план: монтировать как /auth)
├── tests/
│   ├── __init__.py
│   └── test_auth.py
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
- Email OTP (в WebApp)
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

См. CONTRIBUTING.md — формат коммитов, ветвление и правила PR.

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

## Устранение неполадок

- **ModuleNotFoundError: No module named 'pydantic_settings'**
  - **Причина:** сервер запущен глобальным Python без установленных зависимостей проекта.
  - **Решение:**
    1. Установите зависимости через Python из виртуального окружения:
       ```powershell
       .\venv\Scripts\python.exe -m pip install -r requirements.txt
       ```
    2. Запускайте сервер с явным указанием Python из venv (или после активации окружения):
       ```powershell
       .\venv\Scripts\python.exe -m uvicorn app.main:app --reload
       # или, если venv активирован
       python -m uvicorn app.main:app --reload
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

