# API Документация cmpas.ru

## Обзор

REST API для платформы специалистов помогающих профессий.

**Base URL:** `http://localhost:8000/api/v1`

**Аутентификация:** Bearer Token (JWT)

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

### Аутентификация

#### POST /api/auth/telegram

Аутентификация через Telegram.

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
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### POST /api/auth/yandex

Аутентификация через Яндекс ID.

**Request Body:**
```json
{
  "code": "authorization_code_from_yandex"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### POST /api/auth/refresh

Обновление access token.

**Request Body:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

---

### Пользователи

#### GET /api/users/me

Получить информацию о текущем пользователе.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "phone": "+79001234567",
  "full_name": "Иван Иванов",
  "role": "specialist",
  "auth_provider": "telegram",
  "is_active": true,
  "is_verified": true,
  "created_at": "2025-10-04T21:00:00Z",
  "last_login": "2025-10-04T21:15:00Z"
}
```

#### PUT /api/users/me

Обновить профиль текущего пользователя.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "phone": "+79009876543",
  "full_name": "Иван Петрович Иванов"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "newemail@example.com",
  "phone": "+79009876543",
  "full_name": "Иван Петрович Иванов",
  "role": "specialist",
  "auth_provider": "telegram",
  "is_active": true,
  "is_verified": true,
  "created_at": "2025-10-04T21:00:00Z",
  "last_login": "2025-10-04T21:15:00Z"
}
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешный запрос |
| 201 | Ресурс создан |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещен |
| 404 | Ресурс не найден |
| 422 | Ошибка валидации |
| 429 | Слишком много запросов |
| 500 | Внутренняя ошибка сервера |

---

## Rate Limiting

- **Лимит:** 60 запросов в минуту
- **Header:** `X-RateLimit-Remaining`

При превышении лимита возвращается код 429.

---

## Автоматическая документация

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
