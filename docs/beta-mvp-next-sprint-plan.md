# Beta MVP · Next execution plan

Основание: `ТЗ Бета.pdf`, `CJM Карта Беты.pdf`, `docs/beta-mvp-cpo-qa-audit.md`.

## Цель следующего прохода

Довести beta candidate до состояния, где оставшиеся риски честно разделены на:

1. **release blockers** — без них не выпускаем даже ограниченную бету;
2. **beta blockers** — можно дать internal beta, но нельзя называть DoD закрытым;
3. **post-beta hardening** — улучшения без блокировки первого ограниченного теста.

## Срез A · Release blockers

### A1. CI / build recovery

**Почему первым:** после больших правок onboarding, Android dashboard, documents page, voice, bot callbacks и session modal любой TypeScript/Kotlin compile error блокирует всё остальное.

**Что сделать:**
- `npm run lint` / `npx tsc` / `npm run build`;
- Android Build CI;
- исправить compile errors;
- проверить, что `npm run deploy:schema` применяет `deploy/schema-fixes.sql`, `deploy/beta-mvp-schema-fixes.sql`, Prisma migrations.

**DoD:** web и Android build зелёные; последний commit имеет checks/statuses или отдельный лог ручной сборки.

### A2. Smoke path беты

Сценарий:

новый психолог → legal gate → onboarding → документ клиента → первый клиент → invite link/QR → client accepts document → session created → reminder/action link → completion + note nudge → structured note → voice m4a/player → payment mark in Android dashboard and web session modal → document journal CSV → resend outdated document → client cancel blocked/allowed through miniapp, signed link, Telegram callback, MAX callback.

**DoD:** сценарий проходит без ручного SQL и без fake buttons.

### A3. Old APK compatibility

Проверить ответы:

- `/api/mobile/dashboard` — новые поля optional;
- `/api/mobile/sessions` и `/api/mobile/sessions/[id]` — `notes` fallback сохраняется;
- `/api/mobile/legal/status` — старые клиенты не падают на новых полях.

## Срез B · Product/legal blockers

### B1. Web PAY-1 UI

**Сейчас сделано:** backend web endpoint `GET/PATCH /api/diary/sessions/[id]/payment`, mobile PATCH, Android dashboard action, web `SessionModal` buttons `Не требуется / Ожидает / Оплачено` with explicit copy that KOMPAS only records payment status.

**Осталось:** optional right-rail duplication in the calendar screen, if we want payment actions without opening modal.

**DoD:** отметка оплаты видна web ↔ Android, `SessionPaymentRequest` синхронизируется, КОМПАС нигде не выглядит принимающим деньги.

### B2. CANCEL-1 all paths audit

**Сейчас сделано:** miniapp, signed action link, Telegram callback и MAX callback используют единую `canClientCancel`-политику, учитывают `cancellationHours`, пишут `client_cancel_attempt` при поздней отмене и не меняют статус сессии, если отмена уже недоступна.

**Осталось:** smoke-test действующих сообщений/старых inline-кнопок в Telegram/MAX на реальном окружении.

**DoD:** все четыре пути — Telegram, MAX, signed link, miniapp — используют одну политику и проходят smoke.

### B3. Documents journal final UI

**Сейчас сделано:** таб журнала, фильтр «Без согласия/Принятые», CSV с BOM и contentHash, кнопка «Старые версии» в карточке документа: проверяет клиентов со старой версией и запускает resend актуальной версии.

**Осталось:** smoke-test реальной доставки после resend и проверка записи в журнале.

**DoD:** психолог видит старые версии и запускает resend без API-клиента.

## Срез C · Android core blockers

### C1. VOICE-1 honest voice

**Сейчас сделано:** `RECORD_AUDIO`, `MediaRecorder` m4a, локальное хранение, `MediaPlayer`, duration `N:SS`, graceful permission denial, AI teaser под карточкой.

**Осталось:** Android build + device smoke; серверная синхронизация аудио не входит в текущий beta DoD и должна быть отдельным решением по ПДн/безопасности.

**DoD:** на экране заметки можно записать, остановить, прослушать m4a; нет ложного текста о расшифровке.

### C2. Notification center hardening

**Сейчас сделано:** persistent feed, groups today/earlier, mark all visible read, beta types.

**Осталось:** FCM token registration, deep-links, quiet hours 21:00–9:00, morning digest.

**DoD:** push открывает нужную сессию/клиента; ночью не пушит, утром даёт сводку.

## Срез D · Growth/quality blockers

### D1. Calendar import preview UI

**Сейчас:** endpoints есть.

**Осталось:** web UI preview with checkboxes + dedupe visibility.

**DoD:** из onboarding и клиентов можно выбрать будущие события и создать клиентов + sessions.

### D2. Reusable AI teaser

**Сейчас:** отдельные места работают.

**Осталось:** единый web/Android component style.

**DoD:** все AI-зоны используют один паттерн `Скоро ✨ / Хочу первым / Вы в списке ✓`.

## Выполнено в этом проходе

- COMPLETE-1: 15-minute grace window before auto-complete.
- ONB-1: no phantom step, preserves timezone/sessionBreak/lunch/cancellation, adds document/messenger/first client steps.
- Android onboarding bridge: `needsOnboarding` card.
- JOURNAL-1: web journal tab + consent filters + CSV with contentHash.
- DOCVER-1: outdated version check + resend button in documents UI.
- PAY-1: backend GET/PATCH + web session modal controls + Android dashboard action.
- NOTIF-1 UX: Android explicit «Прочитать все» and local read-state update.
- VOICE-1: local m4a recording + player, with honest AI teaser.
- CANCEL-1: miniapp, signed link, Telegram callback and MAX callback all route through `canClientCancel`.

## Release recommendation

До зелёного CI и smoke это **не beta release**. После CI + smoke, но до FCM/right-rail payment duplication — допустим **internal beta candidate** с ограничениями в release notes.
