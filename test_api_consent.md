# Тестирование Consent API (после исправлений)

## Проблемы, которые были найдены и исправлены:

### 1. **Enum mapping issue (КРИТИЧНО)**
- **Проблема:** SQLAlchemy Enum в SQLite хранит lowercase значения (`'terms'`, `'privacy'`, `'advertising'`), но по умолчанию пытается сопоставить их с **именами** членов Python Enum (`TERMS`, `PRIVACY`, `ADVERTISING`), а не с их `.value`.
- **Решение:** Добавлен `values_callable=lambda x: [e.value for e in x]` во все `SQLEnum(ConsentType/ConsentAction)` в моделях, чтобы SQLAlchemy использовал `.value` для сопоставления.

### 2. **Missing flush before return (ВАЖНО)**
- **Проблема:** `autoflush=False` в сессии + отсутствие `await db.flush()` в `accept_consent`/`withdraw_consent` → новые объекты не получали `id` до возврата из функции → `_build_status` возвращал `None` для `id`/`created_at`.
- **Решение:** Добавлен `await db.flush()` и `await db.refresh(consent)` перед возвратом в обеих функциях.

### 3. **JSON parsing в PowerShell curl.exe**
- **Проблема:** Одинарные кавычки в JSON (`'{ "document_id": null }'`) не валидны; PowerShell splatting `@` конфликтует с curl синтаксисом `@file`.
- **Решение:** Использовать переменную с валидным JSON или экранированные двойные кавычки.

## Команды для проверки (после перезапуска сервера):

```powershell
# 1. Обнови токен (из localStorage после входа на https://localhost/auth)
$TOKEN = "<ВСТАВЬ_СВЕЖИЙ_access_token>"

# 2. Прими согласие (используй экранированные кавычки)
curl.exe "https://localhost/api/v1/consents/advertising/accept" -k -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"document_id\":null}"

# 3. Проверь статус (должен вернуть объект с accepted: true)
curl.exe "https://localhost/api/v1/consents/" -k -H "Authorization: Bearer $TOKEN"

# 4. Проверь журнал (должна быть запись с action: "accepted")
curl.exe "https://localhost/api/v1/consents/advertising/logs" -k -H "Authorization: Bearer $TOKEN"

# 5. Отзови согласие
curl.exe "https://localhost/api/v1/consents/advertising/withdraw" -k -X POST -H "Authorization: Bearer $TOKEN"

# 6. Проверь статус снова (accepted должен стать false)
curl.exe "https://localhost/api/v1/consents/" -k -H "Authorization: Bearer $TOKEN"

# 7. Проверь журнал (должна появиться запись с action: "withdrawn")
curl.exe "https://localhost/api/v1/consents/advertising/logs" -k -H "Authorization: Bearer $TOKEN"
```

## Что изменено в коде:

### `app/models/consent.py`
- Все `SQLEnum(ConsentType)` и `SQLEnum(ConsentAction)` теперь с параметрами:
  - `native_enum=False` (для SQLite)
  - `create_constraint=False` (не создавать CHECK constraint)
  - `values_callable=lambda x: [e.value for e in x]` (использовать `.value` для маппинга)

### `app/services/consent_service.py`
- В `accept_consent()` и `withdraw_consent()` добавлено:
  ```python
  await db.flush()
  await db.refresh(consent)
  ```
  перед `return _build_status(consent)`.

## Проверка БД (выполнено):
```
ConsentDocuments (3):
  - ConsentType.TERMS: v2025-10-12, url=/legal/terms
  - ConsentType.PRIVACY: v2025-10-12, url=/legal/privacy
  - ConsentType.ADVERTISING: v2025-10-12, url=/legal/advertising

UserConsents (0):
UserConsentLogs (0):
```

Документы есть, согласий пока нет (ожидаемо до первого accept).
