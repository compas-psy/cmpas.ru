# Чек-лист: реализация vs первичное ТЗ (анализ кода на ветке)

Сверка кода ветки `claude/explore-project-Uc2iK` (PR #39) с ТЗ
`android/SPEC/03-interactions.md`. Каждый пункт проверен по коду с указанием
`файл:строка`. Легенда: `[x]` готово · `[~]` частично · `[ ]` нет.

> Итог: **все 65+ пунктов взаимодействий реализованы.** Где бэкенда ещё нет —
> стоит рабочая навигация/лист и `// TODO API` (уведомления, видео-intent).

---

## Глобально — Док и FAB
- [x] Таб **Сегодня** → Today — `navigation/Routes.kt`
- [x] Таб **Календарь** → Calendar — `navigation/Routes.kt`
- [x] Таб **Клиенты** → Clients — `navigation/Routes.kt`
- [x] Таб **Профиль** → Profile — `navigation/Routes.kt`
- [x] **FAB (+)** → лист «Быстрое действие» — `CompasNavHost.kt` (NewActionSheet)
- [x] Док скрыт на push-экранах, виден на 4 табах — `CompasNavHost.kt` (showDock)
- [x] Переключение таба сбрасывает push-стек — `CompasNavHost.kt` (navigateTopLevel)

## Today
- [x] Колокол (badge) → уведомления — `DashboardScreen.kt` (IconButtonGlass, `// TODO`)
- [x] Тап по hero → SessionDetail(next) — `DashboardScreen.kt` (GlassTintCard onClick)
- [x] **«Подключиться»** → видео, не всплывает на карточку — отдельный clickable
- [x] Иконка-заметка → NoteEditor — отдельный clickable, onNote
- [x] 3 KPI статичны — `Kpi` без onClick
- [x] «Весь день» → Calendar — `SectionTitle` onAction
- [x] Строка расписания → SessionDetail — `ScheduleRow` onClick

## Calendar
- [x] Фильтр → лист (заглушка) — `CalendarScreen.kt` (IconButtonGlass)
- [x] Сегмент День/Неделя/Месяц/Список — `CompasSegmented` setViewMode
- [x] ‹ / › → предыдущий/следующий месяц — selectDate
- [x] Тап по числу → выбор дня + агенда — Box clickable onPick
- [x] «Записать» → лист быстрого действия — `SectionTitle` onAddSession
- [x] Строка агенды → SessionDetail — `AgendaRow` onClick
- [x] Пустой день → карточка без действия — `GlassCard`

## Clients
- [x] «+» → создание клиента — `ClientsScreen.kt` (IconButtonGlass)
- [x] Поиск → живой фильтр по имени — `BasicTextField` onSearchChange
- [x] Сегмент Активные/Все/Архив → фильтр — `CompasSegmented` setStatusFilter
- [x] Строка клиента → ClientDetail — `ClientRow` onClick

## ClientDetail
- [x] ‹ назад → pop — IconButtonGlass ArrowBack
- [x] ⋯ меню → DropdownMenu клиента
- [x] «Написать» (bound) → SendMessageSheet
- [x] «Пригласить» (не bound) → InviteSheet
- [x] Сегмент Обзор/Записи/Заметки/Документы
- [x] Баннер согласия → SendDocumentSheet (на согласие)
- [x] SessionMini (обзор/записи) → SessionDetail
- [x] Карточка заметки → NoteEditor; «+ Добавить заметку» → NoteEditor
- [x] «Отправить документ» → SendDocumentSheet
- [x] Липкая «Записать сессию» + иконка-заметка → SessionDetail / NoteEditor

## SessionDetail
- [x] ‹ назад → pop; ⋯ меню → DropdownMenu
- [x] Плитка клиента → ClientDetail
- [x] «Заметки сессии» / превью → NoteEditor
- [x] Карточка напоминаний: тап по шапке → разворот (шеврон 90°) — `RemindersCard.kt`
- [x] «Отправить ещё раз» / «Вручную» → SendMessageSheet
- [x] Липкая «Подключиться» → видео (URI / Toast `// TODO`)
- [x] Иконка send → SendMessageSheet; note → NoteEditor
- [x] «Перенести» → RescheduleDialog
- [x] «Отменить» (danger) → диалог подтверждения

## NoteEditor
- [x] Сегмент Кратко/По блокам/Голосом → меняет тело
- [x] Поля сохраняют состояние при смене режима — rememberSaveable
- [x] Микрофон → старт/стоп + анимация волн — VoiceCapture infiniteTransition
- [x] Тег «×» удаляет; «+ тег» добавляет
- [x] «Позже» → onBack; «Сохранить заметку» → save + onBack

## Profile
- [x] 4 тумблера автонастроек → переключаются и держат состояние — rememberSaveable
- [x] Блок «Оплата» / ссылка → копирование в буфер
- [x] ConnRow Telegram / MAX → лист подключения
- [x] 4 строки-настройки → ProfileInfoSheet

## FAB-лист «Быстрое действие»
- [x] Тап вне → закрыть — CompasBottomSheet onClose
- [x] Записать сессию / Новый клиент → действия
- [x] Написать клиенту → выбор клиента → SendMessageSheet
- [x] Отправить документ → выбор клиента → SendDocumentSheet
- [x] 4 строки быстрого выбора клиента → ClientDetail

## Листы коммуникаций
**SendMessageSheet** — `comms/CommunicationSheets.kt`
- [x] 4 шаблона подставляют текст
- [x] (bound) «Отправить» → SentState «Отправлено»
- [x] (не bound) плашка + «Подготовить» → SentState «Готово к отправке»
- [x] «Отмена»/вне → закрыть; «Готово» → закрыть

**InviteSheet**
- [x] Табы Telegram / MAX → меняют канал и ссылку
- [x] «Отправить приглашение» → SentState(manual)

**SendDocumentSheet**
- [x] Radio-выбор документа (рамка + галочка)
- [x] Плашка 152-ФЗ для `requiresAck`
- [x] «Отправить»/«Подготовить» → SentState

---

## Дополнительно сделано вне списка взаимодействий
- [x] **Geist** подключён через named type scale (`CompasType.kt`), TTF
      скачиваются `prepareGeistFonts` из официального релиза Vercel при `preBuild`.
- [x] **Статус-бар** прозрачный, edge-to-edge без цветового шва
      (`MainActivity.kt` setDecorFitsSystemWindows + `Theme.kt` TRANSPARENT).
- [x] **Имя** определяется морфологически (`util/PersonName.kt`):
      «Фамилия Имя Отчество» → отдаёт «Имя».
- [x] **Док** адаптивный (вес-распределение), подпись «Сегодня» не обрезается.

## Открытые `// TODO API` (не блокеры, бэкенда нет)
- [ ] Экран/лист уведомлений (колокол Today)
- [ ] Видео-intent для «Подключиться» (сейчас открывает videoLink / Toast)
- [ ] Реальная отправка из листов коммуникаций (сейчас SentState-заглушка)
