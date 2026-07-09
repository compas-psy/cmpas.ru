# Beta MVP · Next execution plan

Основание: `ТЗ Бета.pdf`, `CJM Карта Беты.pdf`, `docs/beta-mvp-cpo-qa-audit.md`.

## Цель следующего прохода

Довести beta candidate до состояния, где оставшиеся риски честно разделены на:

1. **release blockers** — без них не выпускаем даже ограниченную бету;
2. **beta blockers** — можно дать internal beta, но нельзя называть DoD закрытым;
3. **post-beta hardening** — улучшения без блокировки первого ограниченного теста.

## Срез A · Release blockers

### A1. CI / build recovery

**Почему первым:** после больших правок onboarding, Android dashboard и documents page любой TypeScript/Kotlin compile error блокирует всё остальное.

**Что сделать:**
- `npm run lint` / `npx tsc` / `npm run build`;
- Android Build CI;
- исправить compile errors;
- проверить, что `npm run deploy:schema` применяет `deploy/schema-fixes.sql`, `deploy/beta-mvp-schema-fixes.sql`, Prisma migrations.

**DoD:** web и Android build зелёные; последний commit имеет checks/statuses или отдельный лог ручной сборки.

### A2. Smoke path беты

Сценарий:

новый психолог → legal gate → onboarding → документ клиента → первый клиент → invite link/QR → client accepts document → session created → reminder/action link → completion + note nudge → structured note → payment mark → document journal CSV.

**DoD:** сценарий проходит без ручного SQL и без fake buttons.

### A3. Old APK compatibility

Проверить ответы:

- `/api/mobile/dashboard` — новые поля optional;
- `/api/mobile/sessions` и `/api/mobile/sessions/[id]` — `notes` fallback сохраняется;
- `/api/mobile/legal/status` — старые клиенты не падают на новых полях.

## Срез B · Product/legal blockers

### B1. Web PAY-1 UI

**Сейчас сделано:** backend web endpoint `PATCH /api/diary/sessions/[id]/payment`, mobile PATCH, Android dashboard action.

**Осталось:** встроить кнопки оплаты в web calendar/session modal.

**DoD:** отметка оплаты видна web ↔ Android, `SessionPaymentRequest` синхронизируется, КОМПАС нигде не выглядит принимающим деньги.

### B2. CANCEL-1 all paths audit

**Сейчас сделано:** miniapp cancel и signed action link соблюдают `cancellationHours`; reminders TG/MAX используют URL action links.

**Осталось:** проверить, нет ли отдельных TG/MAX callback payload для cancel/reschedule. Если есть — перевести на `canClientCancel` или signed web link.

**DoD:** все четыре пути — TG, MAX, signed link, miniapp — используют одну политику.

### B3. Documents journal final UI

**Сейчас сделано:** таб журнала, фильтр «Без согласия/Принятые», CSV с BOM и contentHash.

**Осталось:** кнопка переотправки клиентам со старой версией прямо из UI документа/журнала.

**DoD:** психолог видит старые версии и запускает resend без API-клиента.

## Срез C · Android core blockers

### C1. VOICE-1 honest voice

**Сейчас:** нельзя считать done.

**Что сделать:**
- `RECORD_AUDIO` permission;
- `MediaRecorder` m4a;
- локальное хранение;
- `MediaPlayer`;
- duration `N:SS`;
- graceful отказ, если permission denied;
- AI teaser под плеером.

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
- PAY-1 backend: web payment endpoint for calendar/session modal integration.
- NOTIF-1 UX: Android explicit «Прочитать все» and local read-state update.

## Release recommendation

До зелёного CI и smoke это **не beta release**. После CI + smoke, но до voice/FCM/web-payment UI — допустим только **internal beta candidate** с ограничениями в release notes.
