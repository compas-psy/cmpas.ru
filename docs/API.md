# API Документация cmpas.ru

REST API для платформы специалистов помогающих профессий.

**Base URL:** `http://localhost:8000/api/v1`

**Аутентификация:** Bearer Token (JWT), Telegram Login Widget или телефонная верификация

---

## Endpoints

### Аутентификация

#### POST /auth/telegram/initiate

Инициация аутентификации через Telegram (устаревший метод).

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

#### POST /auth/telegram/verify

Верификация OTP кода через Telegram (устаревший метод).

**Request Body:**
```json
{
  "telegram_id": "123456789",
  "otp_code": "12345",
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

---

### Телефонная аутентификация

#### POST /auth/phone/initiate

Инициация аутентификации по номеру телефона.

**Request Body:**
```json
{
  "phone_number": "+71234567890"
}
```

**Response:**
```json
{
  "phone_number": "+71234567890",
  "message": "OTP will be sent to your phone number",
  "note": "Integration with Telegram API needed"
}
```

#### POST /auth/phone/verify

Верификация OTP кода по номеру телефона.

**Request Body:**
```json
{
  "phone_number": "+71234567890",
  "otp_code": "12345"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "phone_number": "+71234567890"
}
```

#### POST /auth/phone/telegram/callback

Обработка callback от Telegram Login Widget.

**Request Body:**
```json
{
  "id": 123456789,
  "first_name": "Иван",
  "last_name": "Иванов",
  "username": "ivan_ivanov",
  "photo_url": "https://...",
  "auth_date": 1234567890,
  "hash": "abc123..."
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

---

## Автоматическая документация

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## Telegram MiniApp

Для тестирования аутентификации используйте файл `static/telegram_auth.html`. Откройте его в браузере для тестирования интерфейса аутентификации.
