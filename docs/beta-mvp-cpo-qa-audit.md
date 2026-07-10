# Beta MVP · CPO/QA audit

Основание: `ТЗ Бета.pdf` и `CJM Карта Беты.pdf`.

Дата прохода: 2026-07-09.

## QA-принцип

Не считаем задачу закрытой, если есть только API без UI, UI без сохранения данных, локальный state вместо серверного source of truth, или checklist-галочка без пользовательского пути.

## Критические расхождения, найденные при ревизии

### 1. COMPLETE-1 был закрыт некачественно

**Что было плохо:** автозавершение сессии срабатывало сразу после `endTime`, без буфера `now - 15 минут`, хотя ТЗ требует мягкий cron после завершения и не раньше.

**Риск:** психолог мог получить completed/нудж во время фактического завершения консультации.

**Исправлено:** `src/lib/session-maintenance.ts` теперь использует `POST_SESSION_SETTLE_GRACE_MINUTES = 15`, а текст нуджа приведён к бережному продуктному тону: «Самое время для заметки — если будет удобно».

### 2. ONB-1 был почти false-positive

**Что было плохо:** в `src/app/onboarding/page.tsx` оставался phantom step `3`, прогресс-бар скрывал проблему, часть полей спрашивалась, но не отправлялась (`timezone`, `sessionBreak`, lunch fields). Не было реального шага документов и мессенджера.

**Риск:** пользователь проходит onboarding, но настройки практики не соответствуют тому, что он ввёл. Это прямое нарушение CJM-1.

**Исправлено:** onboarding переписан в честный beta-flow: профиль → расписание → документы → мессенджер → первый клиент → финиш. Email read-only, timezone/sessionBreak/lunch/cancellation реально отправляются, документ клиента создаётся через API, Android получает `needsOnboarding` bridge-card.

**Осталось:** полноценный импорт календаря с preview UI и дедупом должен быть отдельным пользовательским экраном, а не только ссылкой/endpoint.

### 3. LEGAL-1 в целом хорошо, но нельзя ослаблять контроль версий

**Что проверено:** Android legal gate берёт текущие версии через `/api/mobile/legal/status`, требует отдельные explicit checkboxes TERMS/PRIVACY, ADS optional. Web acceptance пишет audit snapshot.

**Осталось проверить в CI/smoke:** новая версия TERMS/PRIVACY должна повторно вызвать gate у старого пользователя.

### 4. CONNECT-1 в целом закрыт, но env/MAX — deployment dependency

**Что есть:** real smart-link, QR/share/copy, channel auto, MAX-first на сервере и в Android, polling в карточке клиента, invite TTL/metrics.

**Осталось:** deployment обязан иметь `MAX_BOT_USERNAME`/MAX env. Код теперь предупреждает, но продуктовый путь без env деградирует до web/TG.

### 5. SCHED-1 в целом закрыт

**Что есть:** `/api/mobile/blocks`, read-only week, mode switch, quick actions today/tomorrow/vacation/end-day. Локальной модели блокировок в `LocalPracticeStore` не найдено, поэтому миграция старых локальных блокировок не требуется.

### 6. NOTES-1 частично закрыт, но требует build/smoke

**Что есть:** mobile API поддерживает `structuredNotes`, Android «По блокам» сохраняет blocks, plain fallback есть.

**Осталось:** отдельный smoke: web structured note → Android edit → web read без потерь. Без этого нельзя считать NOTES-1 fully done.

### 7. VOICE-1 не закрыт

**Что плохо:** текущая голосовая заметка остаётся локальным флагом/черновиком, а не реальной m4a-записью с плеером и permission flow.

**Нужная реализация:** Android `MediaRecorder` → app cache/files, `MediaPlayer`, duration `N:SS`, graceful permission denial, под плеером AI teaser. До этого голос нельзя считать beta-ready.

### 8. PAY-1 частично закрыт

**Что есть:** `DiarySession.paymentStatus`, mobile GET/PATCH, Android dashboard action, unpaid attention item.

**Осталось:** web-кнопки оплаты в calendar/session modal. Без web UI кросс-платформенность PAY-1 неполная.

### 9. CANCEL-1 частично закрыт

**Что есть:** miniapp cancellation и signed web action link соблюдают `cancellationHours` и пишут `client_cancel_attempt`.

**Осталось:** явно проверить/подключить TG bot и MAX bot callback paths, если они не идут через signed link. ТЗ требует все 4 клиентских пути.

### 10. NOTIF-1 не закрыт полностью

**Что есть:** persistent `PracticeNotification`, read-state API, Android notification sheet с beta types.

**Осталось:** FCM push deep-links, quiet hours 21:00–9:00, morning digest, web bell на тех же записях. До этого NOTIF-1 нельзя считать done.

### 11. JOURNAL-1/DOCVER-1 в основном закрыты API-слоем

**Что есть:** journal API, CSV with BOM, outdated document search/resend API.

**Осталось:** убедиться, что web `/diary/documents` показывает общий таб «Журнал», фильтры «Без согласия» / «Старая версия» и массовую переотправку не только API, но и UI.

### 12. Deploy/Prisma rule всё ещё на грани

ТЗ требует: `prisma/schema.prisma` + migration + idempotent DDL в `deploy/schema-fixes.sql`. Сейчас beta DDL вынесен в `deploy/beta-mvp-schema-fixes.sql`, а `scripts/apply-deploy-schema.sh` применяет оба файла.

**QA-вывод:** технически deploy-safe, но формально отличается от ТЗ. Допустимо только если deploy script гарантированно используется в проде. Иначе надо влить beta DDL в основной `deploy/schema-fixes.sql`.

## План доделок до реального DoD

### Must before beta smoke

1. Запустить web build/lint и Android build.
2. Исправить compile ошибки после onboarding refactor.
3. Smoke path: new user → legal → onboarding → document → first client → invite → accept doc → create session → complete → note → payment.
4. Проверить версионный legal re-gate.
5. Проверить old APK compatibility на `/api/mobile/dashboard`, `/sessions`, `/legal/status`.

### Must before beta release

1. VOICE-1 real m4a + player.
2. Web PAY-1 buttons.
3. CANCEL-1 TG/MAX callback audit.
4. NOTIF-1 FCM + quiet hours.
5. Web documents journal UI, not only API.
6. Calendar import preview UI.

## Release decision

Текущий статус после фиксов: **beta candidate backend/mobile core**, но **не final beta DoD**. Выпуск без CI/smoke и без voice/FCM/web-payment должен быть помечен как ограниченный internal beta, а не полноценная beta.
