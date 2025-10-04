# Безопасность проекта cmpas.ru

## Принципы безопасности

Проект следует рекомендациям OWASP и лучшим практикам безопасной разработки.

---

## Аутентификация

### OAuth 2.0

- **Telegram OTP:** Основной метод аутентификации
- **Яндекс ID:** Альтернативный метод

### JWT Токены

- **Access Token:** Время жизни 30 минут
- **Refresh Token:** Время жизни 7 дней
- **Алгоритм:** HS256
- **Secret Key:** Хранится в `.env`, не коммитится в git

---

## Хранение паролей

- ❌ **Никогда не храним пароли в открытом виде**
- ✅ Используем bcrypt для хеширования
- ✅ Salt генерируется автоматически
- ✅ Cost factor: 12 (по умолчанию в bcrypt)

---

## OTP коды

- ❌ **Не храним OTP коды в базе данных**
- ✅ Храним только хеши с TTL (время жизни)
- ✅ Коды действительны 5 минут
- ✅ Максимум 3 попытки ввода

---

## Защита от атак

### SQL Injection

- ✅ Используем SQLAlchemy ORM
- ✅ Параметризованные запросы
- ✅ Валидация всех входных данных через Pydantic

### XSS (Cross-Site Scripting)

- ✅ Экранирование HTML в шаблонах
- ✅ Content Security Policy headers
- ✅ Валидация и санитизация пользовательского ввода

### CSRF (Cross-Site Request Forgery)

- ✅ CSRF токены для форм
- ✅ SameSite cookies
- ✅ Проверка Origin/Referer headers

### Rate Limiting

- ✅ 60 запросов в минуту на IP
- ✅ Специальные лимиты для критичных endpoints:
  - Логин: 5 попыток в минуту
  - Регистрация: 3 попытки в минуту
  - OTP: 3 попытки в 5 минут

---

## HTTPS

### Development

- HTTP разрешен только на localhost

### Production

- ✅ **Только HTTPS**
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ Redirect с HTTP на HTTPS
- ✅ Минимальная версия TLS 1.2

---

## CORS

### Настройки

```python
ALLOWED_ORIGINS = [
    "https://cmpas.ru",
    "https://www.cmpas.ru",
]
```

- ✅ Строгий whitelist доменов
- ✅ Credentials разрешены только для доверенных доменов
- ❌ `allow_origins=["*"]` запрещено в production

---

## Секреты и переменные окружения

### Правила

1. ❌ **Никогда не коммитить `.env` в git**
2. ✅ Использовать `.env.example` как шаблон
3. ✅ Все секреты только в переменных окружения
4. ✅ Разные секреты для dev/staging/prod

### Обязательные секреты

```env
SECRET_KEY=<случайная строка минимум 32 символа>
TELEGRAM_BOT_TOKEN=<токен от BotFather>
YANDEX_CLIENT_SECRET=<секрет от Яндекс ID>
```

### Генерация SECRET_KEY

```python
import secrets
print(secrets.token_urlsafe(32))
```

---

## Логирование

### Что логируем

- ✅ Попытки входа (успешные и неуспешные)
- ✅ Изменения критичных данных
- ✅ Ошибки и исключения
- ✅ Подозрительная активность

### Что НЕ логируем

- ❌ Пароли
- ❌ Токены
- ❌ OTP коды
- ❌ Персональные данные (без необходимости)

---

## Валидация данных

### Pydantic схемы

- ✅ Валидация всех входных данных
- ✅ Типизация полей
- ✅ Ограничения на длину строк
- ✅ Проверка email, phone и других форматов

### Пример

```python
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, regex=r'^\+?[1-9]\d{1,14}$')
```

---

## Обновления зависимостей

### Регулярные проверки

```bash
# Проверка уязвимостей
pip-audit

# Обновление зависимостей
pip list --outdated
```

### Автоматизация

- GitHub Dependabot для автоматических PR с обновлениями
- Проверка уязвимостей в CI/CD pipeline

---

## Чеклист безопасности

### Перед деплоем в production

- [ ] `DEBUG=False` в `.env`
- [ ] Сгенерирован новый `SECRET_KEY`
- [ ] Настроен HTTPS
- [ ] Настроен CORS с whitelist доменов
- [ ] Включен rate limiting
- [ ] Настроено логирование
- [ ] Обновлены все зависимости
- [ ] Проведен security audit
- [ ] Настроен мониторинг

---

## Отчеты об уязвимостях

Если вы нашли уязвимость, пожалуйста:

1. **НЕ создавайте публичный Issue**
2. Отправьте описание на security@cmpas.ru
3. Дайте нам время исправить проблему
4. После исправления мы укажем вас в благодарностях

---

## Ресурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
