# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Public routes: `/legal`, `/legal/terms`, `/legal/privacy`, `/legal/advertising` (HTML stubs for MVP).
- Route `/auth` serving `static/telegram_auth.html`.
- Alembic migration `003_seed_consent_documents` to seed ConsentDocument entries (terms/privacy/advertising) with URLs to `/legal/*`.
- Consent API endpoints: `GET /api/v1/consents/`, `POST /api/v1/consents/{type}/accept`, `POST /api/v1/consents/{type}/withdraw`, `GET /api/v1/consents/{type}/logs`.

### Changed
- Yandex OAuth callback now redirects to `/auth#...` (was `/static/telegram_auth.html#...`).
- `static/telegram_auth.html` legal links updated to `/legal/*` (instead of `/static/legal/*.pdf`).
- Consent acceptance without `document_id` now auto-attaches the latest ConsentDocument version for the given type.

### Fixed
- **CRITICAL:** SQLAlchemy Enum mapping for SQLite — added `values_callable=lambda x: [e.value for e in x]` to all `SQLEnum(ConsentType/ConsentAction)` to correctly map lowercase DB values to Python Enum members.
- Added `await db.flush()` and `await db.refresh()` in `accept_consent` and `withdraw_consent` to ensure objects receive `id` and timestamps before returning from service functions.
- Alembic migration `002` made idempotent (checks for existing tables/indexes before creating).
- Alembic `env.py` now converts async database URLs to sync for migrations (fixes `MissingGreenlet` error with `sqlite+aiosqlite`).

### Planned
- Legal: consent journal UI/exports; capture consents at booking.
- Scheduling/Bookings: slot generator, booking via `/b/:token`, ICS export, confirm/reschedule/cancel.
- Telegram Productivity: reminders (24h/2h), Inline mode, MiniActions.
- Smart helpers: quick encrypted notes, intake forms, message templates, exports.

## [0.1.0] - 2025-10-12
### Added
- Yandex ID login (OAuth 2.0).
- Email OTP authentication in Telegram WebApp shell.
- JWT access/refresh tokens (`/api/v1/auth/refresh`, `/api/v1/users/me`).
- Rate limiting on auth and critical endpoints.
- Auth page at `static/telegram_auth.html` (mounted as `/auth`).
- FastAPI project structure with SQLAlchemy, Alembic, Pydantic.

### Changed
- README rewritten to reflect the new product vision and MVP scope.

### Security
- Secrets in `.env`, HTTPS in production, input validation, basic OWASP controls.
