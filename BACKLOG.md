# Product Backlog — cmpas.ru

## Sprint A: Legal & Consent Foundation ✅ COMPLETED
- [x] Public legal pages (`/legal`, `/legal/terms`, `/legal/privacy`, `/legal/advertising`)
- [x] Auth page mounted at `/auth`
- [x] Consent API (`accept`, `withdraw`, `list`, `logs`)
- [x] ConsentDocument versioning and seeding
- [x] Fix SQLAlchemy Enum mapping for SQLite
- [x] Fix flush/refresh in consent service

**Status:** All core consent functionality working. Users can accept/withdraw advertising consent, and all actions are logged with document versions and request metadata.

---

## Sprint B: Scheduling & Bookings (Next Priority)
### Core Features
- [ ] **Slot Generator**: Admin API to create recurring time slots (weekly schedule)
- [ ] **Booking Model**: `Booking` table with fields: `id`, `user_id`, `slot_id`, `status` (pending/confirmed/cancelled), `created_at`, `confirmed_at`
- [ ] **Public Booking Link**: `/b/:token` route for clients to book available slots
- [ ] **Booking API**:
  - `GET /api/v1/slots/available` — list open slots
  - `POST /api/v1/bookings/` — create booking
  - `GET /api/v1/bookings/me` — user's bookings
  - `PATCH /api/v1/bookings/{id}/confirm` — confirm booking
  - `PATCH /api/v1/bookings/{id}/reschedule` — reschedule
  - `DELETE /api/v1/bookings/{id}` — cancel
- [ ] **ICS Export**: `GET /api/v1/bookings/{id}/ics` — download .ics calendar file

### Technical Tasks
- [ ] Alembic migration for `slots` and `bookings` tables
- [ ] Slot conflict detection (prevent double-booking)
- [ ] Booking token generation and validation
- [ ] Email/Telegram notification on booking confirmation

---

## Sprint C: Telegram Productivity
### Core Features
- [ ] **Reminders**: Telegram bot sends reminders 24h and 2h before booking
- [ ] **Inline Mode**: Quick search and share booking links via Telegram inline queries
- [ ] **MiniActions**: Telegram bot commands:
  - `/mybookings` — list user's bookings
  - `/cancel <id>` — cancel booking
  - `/reschedule <id>` — request reschedule

### Technical Tasks
- [ ] Telegram bot webhook setup
- [ ] Scheduled task runner (e.g., APScheduler or Celery) for reminders
- [ ] Inline query handler for booking search
- [ ] Bot command handlers

---

## Sprint D: Smart Helpers
### Core Features
- [ ] **Quick Encrypted Notes**: Store session notes with client-side encryption
- [ ] **Intake Forms**: Pre-session questionnaires for clients
- [ ] **Message Templates**: Admin-defined templates for common responses
- [ ] **Data Exports**: Export bookings/consents/notes to CSV/JSON

### Technical Tasks
- [ ] Notes model with encryption key management
- [ ] Form builder API and UI
- [ ] Template engine integration
- [ ] Export API endpoints

---

## Backlog (Future Enhancements)
- [ ] Multi-language support (i18n)
- [ ] Payment integration (Stripe/YooKassa)
- [ ] Video call integration (Zoom/Google Meet)
- [ ] Analytics dashboard (booking stats, consent rates)
- [ ] Mobile app (React Native/Flutter)
- [ ] Advanced scheduling (recurring bookings, waitlist)
- [ ] Client portal (view history, download receipts)

---

## Technical Debt
- [ ] Add comprehensive unit tests for consent service
- [ ] Add integration tests for auth flows
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add API documentation (Swagger/ReDoc)
- [ ] Implement proper logging (structured logs with context)
- [ ] Add monitoring (Sentry, Prometheus)
- [ ] Database connection pooling optimization
- [ ] Rate limiting per user (not just global)

---

## Notes
- **Current Version:** 0.1.0 (MVP in active development)
- **Next Milestone:** Sprint B (Scheduling & Bookings) — Target: 2 weeks
- **Tech Stack:** FastAPI, SQLAlchemy, Alembic, SQLite (dev) / PostgreSQL (prod), Telegram Bot API
