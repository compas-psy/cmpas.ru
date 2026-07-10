# Аудит безопасности КОМПАС (ПДн / 152-ФЗ, защита от атак)

> Продукт хранит чувствительные ПДн клиентов (ФИО, телефоны, заметки о
> психологических сессиях — близкие к медицинским данным). Аудит
> сгруппирован по: аутентификация/авторизация, утечки ПДн, подлинность
> webhook, секреты, инъекции, hardening. Заметки — чувствительные ПДн
> (специальная категория, ст. 10 152-ФЗ).
>
> Статус: ✅ исправлено в этом проходе · 🔧 требует доработки (ТЗ ниже) ·
> ℹ️ инфраструктура/на стороне владельца.

---

## Сводка critical/high

| # | Severity | Проблема | Статус |
|---|---|---|---|
| A1 | **Critical** | `/api/user/diary/bot/client/cancel` — отмена любой сессии без auth (IDOR) | ✅ (clientId + HMAC-токен + ownership) |
| A2 | **Critical** | Telegram webhook без проверки подлинности — подделка callback confirm/cancel | ✅ secret_token |
| A3 | **Critical** | `mobile-auth` подписывал JWT ключом `AUTH_SECRET \|\| 'fallback-secret'` — форж токена любого психолога | ✅ ephemeral random + timing-safe |
| A4 | **High** | `client-workflow` секрет `'cmpas-local-secret'` (публичен в репо) — форж action/document токенов | ✅ ephemeral random + timing-safe |
| A5 | **High** | Telegram webhook логировал текст сообщений клиентов (ПДн) | ✅ только update_id + тип |
| A6 | **High** | Секреты захардкожены в `deploy-docker.yml` (fallback-токены) | 🔧 см. S1 |
| A7 | **High** | MAX webhook без проверки подлинности | 🔧 см. S2 |
| A8 | **High** | Согласие 152-ФЗ фиксируется открытием ссылки (GET), не действием | 🔧 DOC-1 в tz-cjm-audit-beta2.md |
| A9 | **Medium** | Telegram/MAX MiniApp доверяет `initDataUnsafe` без HMAC-валидации | 🔧 см. S3 |
| A10 | **Medium** | Нет rate-limiting на magic-link/booking/webhook | 🔧 см. S4 |
| A11 | **Medium** | Нет security-заголовков (HSTS/nosniff/frame) | ✅ next.config |
| A12 | **Medium** | `clientActionToken` статичен на клиента (не на сессию) — утёкшая ссылка действует на все будущие сессии | 🔧 см. S5 |
| A13 | **Low** | Postgres `trust` auth в контейнере | ℹ️ порт не проброшен, приемлемо |
| A14 | **Low** | Android keystore-пароль в репо | ℹ️ подписывает только sideload-сборки |

---

## Что исправлено в этом проходе (коммиты в ветке)

### A2 — Подлинность Telegram webhook (`src/app/api/telegram/webhook/route.ts`)
Добавлена проверка заголовка `X-Telegram-Bot-Api-Secret-Token` (timing-safe)
против `TELEGRAM_WEBHOOK_SECRET`, который генерируется на деплое и ставится
как `secret_token` в `setWebhook`. Без этого любой знающий публичный URL мог
слать поддельные апдейты: фейковый `callback_query` для подтверждения/отмены
угаданной сессии, поддельное `/start c_<token>`. Fail-open только если секрет
не задан (защита от мисконфига); деплой всегда задаёт.

### A3 — Форжабельный JWT-секрет (`src/lib/mobile-auth.ts`)
Убран константный fallback `'fallback-secret'` → случайный ephemeral-ключ при
отсутствии `AUTH_SECRET` (токены не переживают рестарт, но их нельзя подделать).
Сравнение подписи переведено на `crypto.timingSafeEqual`.

### A4 — Публичный секрет действий (`src/lib/client-workflow.ts`)
`'cmpas-local-secret'` (был виден в репозитории) → ephemeral random.
`verifyClientActionToken`/`verifyDocumentDeliveryToken` — timing-safe.

### A5 — Логи ПДн
Убрано логирование текста сообщений/`callback_data` из Telegram webhook.

### A11 — Security-заголовки (`next.config.ts`)
HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`Permissions-Policy`; `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`
только на `/diary` и `/admin` (MiniApp `/bot/*` и публичные `/connect`,
`/client` остаются фреймящимися — иначе Telegram MiniApp сломается).

---

## ТЗ на доработку (осталось)

### S1 (High) — Убрать захардкоженные секреты из `deploy-docker.yml`
**Файл:** `.github/workflows/deploy-docker.yml`.
**Сейчас:** fallback-значения токенов прямо в YAML (в истории git навсегда):
`TELEGRAM_BOT_TOKEN` (:56/:93), `YANDEX_CLIENT_SECRET`,
`GOOGLE_CALENDAR_CLIENT_SECRET`, `TINKOFF_PASSWORD`, `DADATA` fallback,
`TELEGRAM_CHAT_ID`.
**Надо:** перевести все на `${{ secrets.* }}` без литеральных fallback (как уже
сделано для `MAX_BOT_TOKEN`), добавить недостающие секреты в GitHub, а
скомпрометированные (засвеченные в истории) — **перевыпустить** у провайдеров
(BotFather, Yandex OAuth, Google Cloud, Тинькофф).
**Приёмка:** `grep -E '(secret|password|token).*=.*[A-Za-z0-9]{16}'
deploy-docker.yml` не находит литералов.

### S2 (High) — Подлинность MAX webhook
**Файл:** `src/app/api/max/webhook/route.ts`, регистрация в `deploy-docker.yml`.
**Сейчас:** `POST` обрабатывает любой вход без проверки источника.
**Надо:** т.к. MAX Bot API не шлёт secret-header, регистрировать webhook с
URL-параметром-секретом (`.../api/max/webhook?s=<MAX_WEBHOOK_SECRET>`) и
проверять `request.nextUrl.searchParams.get('s')` timing-safe. Fail-open если
секрет не задан.
**Приёмка:** POST без правильного `?s=` → 200/no-op; легитимные апдейты MAX
проходят.

### S3 (Medium) — Валидация Telegram `initData` в MiniApp
**Файлы:** `src/app/bot/client/page.tsx` (:28-33 использует
`initDataUnsafe.user`), `src/app/bot/book/[psychologistId]/page.tsx`,
серверные actions `getClientSessions`/`getClientSessionsById`.
**Сейчас:** личность клиента берётся из `initDataUnsafe` (клиент-контролируемо)
или `localStorage.compas_clientId` — подделываемо, можно листать чужие записи.
**Надо:** передавать `initData` (подписанную строку) на сервер, валидировать
HMAC по `TELEGRAM_BOT_TOKEN` (`src/lib/telegram-login.ts` уже умеет похожее для
login-widget — переиспользовать), и только по валидированному `user.id`
резолвить клиента. Для не-Telegram доступа — токен из ссылки, не сырой
`clientId` из localStorage.
**Приёмка:** запрос с подделанным `initData`/чужим `clientId` не возвращает
чужие сессии.

### S4 (Medium) — Rate limiting
**Файлы:** `src/app/api/mobile/auth/login` (magic link), `/api/auth/*`,
`/bot/book` booking actions, оба webhook.
**Сейчас:** нет никакого ограничения частоты — спам magic-link на email,
перебор, флуд webhook.
**Надо:** простой лимитер (по IP + по email/ключу) — например, счётчик в
Postgres/памяти: N попыток / окно. Для magic-link — не более 3–5 писем на
email за 15 мин. Для webhook — размер тела/частота.
**Приёмка:** 6-я попытка логина за окно → 429; письма не спамятся.

### S5 (Medium) — Скоуп `clientActionToken` до сессии
**Файл:** `src/lib/client-workflow.ts` (:13-22).
**Сейчас:** токен = `sha256(psyId:clientId:secret)` — статичен на клиента.
Одна утёкшая ссылка (из пересланного сообщения) позволяет отменять/действовать
на **все** будущие сессии клиента бессрочно.
**Надо:** включить в токен `sessionId` и срок (`expiresAt`), проверять оба.
Ссылки на действие с сессией генерировать под конкретную сессию.
**Приёмка:** токен одной сессии не проходит для другой; просроченный отклоняется.

### S6 (Low) — 152-ФЗ по данным
- **Аналитика:** `VisitorAnalytics`/`PageView` — проверить сбор IP/UA,
  добавить срок хранения и основание обработки; согласие на аналитику.
- **Экспорт/удаление ПДн:** реализовать право субъекта на удаление
  (сейчас в ТЗ беты как заглушка «Данные и конфиденциальность»).
- **Шифрование заметок в покое:** рассмотреть шифрование `notes`/
  `structuredNotes` (самое чувствительное поле) прикладным ключом.

---

## Инфраструктурные заметки (ℹ️)
- **Postgres trust-auth** (`deploy-docker.yml`) — порт 5432 не проброшен на
  хост, доступ только из docker-сети. Приемлемо, но при добавлении любого
  сервиса в сеть — вернуть `scram-sha-256` + пароль.
- **Порт app 3000** — убедиться, что наружу только через TLS reverse-proxy
  (nginx/ISPManager), не напрямую.
- **Android keystore** (`android/keystore/*.jks`, пароль в
  `build.gradle.kts`) — подписывает только sideload-сборки, не Play Store;
  риск ограничен, но для Play-релиза завести отдельный ключ вне репо.
- **`AUTH_SECRET`** — единый источник для web-сессий, mobile-JWT и
  action-токенов. Его ротация инвалидирует всё разом (сессии, mobile-логины,
  ссылки). Хранить только в секретах, не терять.
