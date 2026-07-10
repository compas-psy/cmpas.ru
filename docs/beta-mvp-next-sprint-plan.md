# Beta MVP · Next execution plan

Основание: `ТЗ Бета.pdf`, `CJM Карта Беты.pdf`, `docs/beta-mvp-cpo-qa-audit.md`.

## Текущий статус

Код содержит большую часть beta-функций, но выпуск блокируют отсутствие доказанного зелёного build, неполный smoke и несколько schema/legal рисков. Часть прежних галочек была завышена: настоящая Android m4a-запись откатана, а audit-поля legal acceptance ещё не подтверждены во всех окружениях.

## Срез A · Release blockers

### A1. Build recovery

- получить доступный Android build log;
- `npm run lint`, `npx tsc`, `npm run build`;
- Android `assembleDebug`;
- исправлять только конкретные compile errors, не добавлять новые крупные функции до зелёной сборки;
- проверить, что workflow запускается на push в `main`, а не только виден в YAML.

**DoD:** web и Android зелёные, лог доступен и привязан к commit SHA.

### A2. Legal gate smoke

Проверить два сценария:

1. ПС/ПК не приняты, ADS не выбран: открыть все документы во встроенном viewer, вернуться с сохранёнными чекбоксами, принять ПС/ПК, попасть в приложение; отдельное ADS-окно не появляется.
2. ПС/ПК не приняты, ADS выбран: обязательные документы сохраняются первым запросом, ADS вторым; ошибка ADS не блокирует вход.

Дополнительно:
- проверить актуальные URL `/legal/terms`, `/legal/privacy`, `/legal/consent/marketing`;
- применить audit-DDL `source/documentType/documentVersion` и синхронизировать Prisma schema;
- заменить `{{ОГРНИП}}/{{ИНН}}` реальными реквизитами до внешней beta.

**DoD:** повторный `/api/mobile/legal/status` возвращает `requiresTermsAcceptance=false`; отсутствие ADS не открывает gate.

### A3. Full beta smoke

новый психолог → legal → onboarding → первый клиент → invite/QR → client document → session → completion/nudge → structured note → payment → journal CSV/resend → allowed/blocked cancellation in miniapp, signed link, Telegram and MAX.

### A4. Old APK compatibility

- `/api/mobile/dashboard`: новые поля optional;
- `/api/mobile/sessions` и `/api/mobile/sessions/[id]`: старый `notes` fallback;
- `/api/mobile/legal/status`: старые клиенты не падают на новых полях;
- новые JSON responses не ломают старые `Response<Unit>` клиенты.

## Срез B · Product/legal completion

### B1. Calendar import preview UI

Endpoints есть, но пользовательского preview с чекбоксами и видимой дедупликацией нет.

### B2. Documents journal smoke

Проверить реальную доставку после «Старые версии», новый delivery и появление строки в журнале/CSV.

### B3. Payment surfaces

Session modal и Android action готовы. Calendar right rail — optional duplication, не release blocker при рабочем modal.

### B4. Cancellation smoke

Кодовые пути сведены к `canClientCancel`; нужны реальные проверки старых и новых Telegram/MAX inline-кнопок.

## Срез C · Android completion

### C1. Voice

Настоящий `MediaRecorder`/m4a/player откатан ради build recovery. Сейчас остаётся только честный локальный черновик.

**Следующий шаг после зелёного build:** вернуть запись отдельным маленьким PR с device test, permission test и lifecycle test.

### C2. Notifications

- проверить FCM registration;
- deep-links в сессию/клиента;
- тихие часы 21:00–9:00;
- утренняя сводка;
- убедиться, что все важные события пишут persistent notification.

## Срез D · Quality/growth

- reusable AI teaser для web/Android;
- deployment smoke MAX-first;
- schema drift audit: Prisma schema ↔ migrations ↔ deploy SQL;
- финальная юридическая сверка web-текстов с утверждёнными DOCX.

## Последний выполненный legal-fix

- обязательные ПС/ПК и optional ADS разделены на разные запросы;
- backend сначала сохраняет acceptance в базовые колонки, а audit snapshot обогащает best-effort;
- ADS остаётся на первом экране, но не влияет на enabled кнопки и вход;
- отдельный автоматический ADS popup после принятых ПС/ПК отключён;
- документы открываются внутри Android WebView с кнопкой «Назад к согласиям»;
- чекбоксы сохраняются при просмотре;
- Retrofit получает явный `MobileLegalAcceptResponse`, а не `Unit`.

## Release recommendation

До зелёных build и smoke — **не выпускать внешнюю beta**. После A1–A4 допустим internal beta candidate. FCM/quiet hours и voice можно завершать следующим небольшим срезом, не смешивая их с аварийным восстановлением сборки.
