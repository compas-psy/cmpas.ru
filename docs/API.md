# API Документация cmpas.ru

## Обзор

REST API для платформы специалистов помогающих профессий.

**Base URL:** `http://localhost:8000/api/v1`

**Аутентификация:** Bearer Token (JWT) или Telegram OTP

---

## Endpoints

### Health Check

#### GET /health

Проверка состояния сервера.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development"
}
```

---

### Системные эндпоинты

#### GET /system/ping

Быстрая проверка доступности API v1.

**Response:**
```json
{
  "status": "ok"
}
```

---

### Аутентификация

#### POST /auth/telegram/initiate

Инициировать аутентификацию через Telegram (отправляет OTP код).

**Request Body:**
```json
{
  "telegram_id": "123456789",
  "first_name": "Иван",
  "last_name": "Иванов",
  "username": "ivan_ivanov",
  "auth_date": 1234567890,
  "hash": "abc123..."
}
```

**Response:**
```json
{
  "request_id": "123456789",
  "message": "OTP sent to Telegram"
}
```

#### POST /auth/telegram/verify

Подтвердить аутентификацию через Telegram (проверить OTP код).

**Request Body:**
```json
{
  "telegram_id": "123456789",
  "otp_code": "123456",
  "full_name": "Иван Иванов",
  "username": "ivan_ivanov"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": 1
}
```

#### POST /auth/yandex/callback

Обработка callback от Яндекс ID OAuth (пока не реализован).

**Response:**
```json
{
  "status": "not_implemented",
  "message": "Yandex auth not yet implemented"
}
```

---

## Rate limiting

- Лимит по умолчанию: 60 запросов в минуту на IP.
- При превышении возвращается статус `429 Too Many Requests` с описанием ошибки.

---

## Автоматическая документация

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
