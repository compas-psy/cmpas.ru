# 02 · Экраны 1:1

Каждый блок: **данные → раскладка сверху вниз → взаимодействия**. Сверяй с
соответствующей функцией в `compas-screens.jsx` / `compas-app.jsx` /
`compas-notes.jsx` / `compas-comms.jsx`.

---

## 0. Мок-данные → `domain/model/Models.kt` + `data/`

Перенеси из `compas-ui.jsx` ровно эти наборы (имена, статусы — без изменений),
чтобы экраны выглядели как прототип:

- **CLIENTS** (6): Анна Ковалёва (АК, Forest, КПТ, «Тревога, выгорание»),
  Дмитрий Соколов (ДС, Blue, Терапия пар), Мария Петрова (МП, Accent,
  Психоанализ), Игорь Лебедев (ИЛ, Violet, КПТ, «Панические атаки»),
  Елена Волкова (ЕВ, Red, Гештальт), Сергей Морозов (СМ, серый, Коучинг, архив).
  Поля: `id, name, short, ini, color, tag, since, sessions, next, status, request`.
- **SESSIONS** (4 сегодня): 10:00 Анна video confirmed · 12:30 Дмитрий video
  confirmed · 15:00 Мария offline pending · 17:30 Игорь phone confirmed.
  Поля: `id, clientId, time, dur, fmt(video|phone|offline), status`.
- **MESSENGER**: anna/dmitry/igor → telegram bound; maria → max **не** bound;
  elena → max bound; sergey → нет канала. `bound` = открыл ли клиент бота.
- **CONSENT**: anna/dmitry/igor/sergey ok · maria missing · elena expired.
- **DOC_TEMPLATES** (5): Согласие 152-ФЗ v2.1 (ack), Политика v1.4 (ack),
  Договор v1.0 (ack), Дневник эмоций (homework), Заземление 5-4-3-2-1 (homework).

> Бизнес-правило (важно для листов): **бот не может писать первым**. Если
> `bound=false` — отправка только «вручную» (подготовить текст → share-лист),
> либо сначала «Пригласить в бот».

---

## 1. Today (Сегодня) → `presentation/today/TodayScreen.kt`

**Данные:** `next = SESSIONS[1]` (Дмитрий 12:30), `nc = client(next)`.

**Раскладка (скролл, поля 20):**
1. **Header:** eyebrow «Четверг · 11 июня» + `tHero` «Добрый день, Никита»;
   справа `IconButtonGlass(bell, badge=true)`.
2. **Hero `GlassTintCard`** (тёмная) — **строго 3 яруса (см. Баг A в README):**
   - ряд: «СЛЕДУЮЩАЯ СЕССИЯ» (white α.62, 11.5/700, uppercase) … пилюля справа
     «через 3 ч» (иконка clock `Accent400` + текст, фон white α.14, радиус 999).
   - ряд: `Avatar(nc,52,ring)` + колонка `[имя white 18/700 maxLines=1 ellipsis]`
     и мета-ряд `12:30 · 60 мин · [video] Видео` (white α.78, 13.5/500).
   - ряд кнопок (`gap 10`): белая «Подключиться» (flex, иконка video `Forest800`,
     текст `Forest800` 700) + квадрат 52×46 (white α.10, border white α.22,
     иконка note белая).
   - Тап по самой карточке (вне кнопок) → `onSession(next)`; у внутренних кнопок
     `stopPropagation` (в Compose — отдельные `clickable`, не всплывают).
3. **KPI-ряд** (3 плитки `Kpi`, grid 1:1:1, gap 10): calendar «4 сессии»
   Forest600 · users «24 клиента» Blue · wallet «54к ₽ неделя» Accent.
4. **SectionTitle «Расписание»** с действием «Весь день» (chevR).
5. **Список `ScheduleRow`** по всем SESSIONS — таймлайн: слева время+длит.
   (правый край), вертикальная линия с цветной точкой статуса, затем
   `GlassCard`: аватар 40 + имя (1 строка ellipsis) + `FmtChip`, точка статуса,
   chevR. Тап → `onSession(s)`.

---

## 2. Calendar (Календарь) → `presentation/calendar/CalendarScreen.kt`

**Состояние:** `sel` (выбранный день, по умолч. 11), месяц Июнь 2026
(1-е = понедельник, 30 дней). `busy` = карта день→число сессий
(9:2,10:1,11:4,12:2,15:3,16:1,18:2,22:3,23:1,25:2).

**Раскладка:**
1. Header: eyebrow «Расписание» + `tHero` «Календарь»; справа `IconButtonGlass(filter)`.
2. **Сегмент День/Неделя/Месяц/Список** (`CompasSegmented`) — на скрине он есть;
   активный «Месяц». Переключение меняет представление (минимум: Месяц —
   сетка ниже; Список — вертикальный список сессий; День/Неделя — агенда дня/недели).
3. **`GlassCard(strong)` — сетка месяца** (то, что на скрине «бледно»):
   - шапка: «Июнь 2026» 16.5/700 + две круглые стеклянные кнопки ‹ › (`RoundChev`).
   - строка дней недели Пн…Вс (выходные Сб/Вс — цвет `Accent`).
   - grid 7 колонок, ячейки `aspectRatio 1`, радиус 13. Для каждого дня:
     - **выбранный**: фон-градиент `Forest700→Forest900`, число белое 700, тень;
     - **сегодня (11)**: число `Forest700` 700 (без фона);
     - обычный: число `CompasFg` 550.
     - под числом — до 3 точек загрузки (выбранный → white α.85, иначе `Accent`).
   - тап по дню → `setSel(day)`.
4. **SectionTitle** «{Сегодня | N июня} · {k} сессии» с действием «Записать».
5. **Агенда дня:** если день=11 → все SESSIONS; иначе по `busy` 0..N строк
   `ScheduleRow`. Пусто → `GlassCard` «Нет записей на этот день». Тап →
   `onSession`.

> На скрине агенда — белая плоская карточка с точкой. Заменить на `ScheduleRow`
> с таймлайном и аватаром, как на Today.

---

## 3. Clients (Клиенты) → `presentation/clients/ClientsScreen.kt`

**Состояние:** `seg` (active|all|archive, по умолч. active), `q` (поиск).
Фильтр: по статусу + по подстроке имени (lowercase contains).

**Раскладка:**
1. Header: eyebrow «База · 24 человека» + `tHero` «Клиенты»; справа `IconButtonGlass(plus)`.
2. **Стеклянное поле поиска** (высота 46, радиус 15): иконка search + `TextField`
   плейсхолдер «Поиск по имени». Печать фильтрует список вживую.
3. **Сегмент Активные/Все/Архив** (`CompasSegmented`). (На скрине сейчас три
   псевдо-чипа «Активные 8 / Пауза 0 / Архив 0» — заменить на сегмент-контрол
   как в прототипе; счётчики не нужны.)
4. **Список `ClientRow`** (стекло, радиус 22, mb 11): `Avatar 46` +
   `[имя 15.5/650] [тег-пилюля Sage100/Forest600]` и ниже строка
   `[calendar] {c.next}` (если начинается с «Сегодня» — цвет `Forest700`),
   справа chevR. Тап → `onClient(c)`.

---

## 4. ClientDetail (карточка клиента, push) → `presentation/clients/ClientDetailScreen.kt`

**Шелл:** `PushScreen(title = c.short)` — стеклянная шапка [‹ назад] [title]
[⋯ меню]. Контент скроллится, снизу — **липкая панель действий**.

**Данные:** `history` (3 завершённые), `upcoming` (10:00 confirmed),
`consent=CONSENT[c.id]`, `docs` (4 доставки на основе шаблонов).

**Раскладка:**
1. **Hero `GlassTintCard`**: `Avatar 62 ring` + имя 20/700 white + ряд
   [тег white-пилюля] [«с {since}» white α.72].
2. **`MessengerStatusRow`** (стекло): иконка канала + название + статус
   (`@handle` / «приглашение не открыто» / телефон). Справа кнопка:
   - `bound` → «Написать» (открывает лист `msg`);
   - иначе → «Пригласить» (открывает лист `invite`).
3. **Сегмент Обзор/Записи/Заметки/Документы** (`CompasSegmented`).
4. Содержимое вкладки:
   - **Обзор:** ряд из 3 `StatusMini` (Согласие/Оплаты/Д·з с цветом по
     состоянию) → если согласие не «ok», баннер-предупреждение (тап → лист
     `doc`) → `GlassCard` «Фокус работы» (флаг + `c.request`) → eyebrow
     «Следующая сессия» + `SessionMini(upcoming)`.
   - **Записи:** eyebrow «Предстоящие» + `SessionMini(upcoming)`; eyebrow
     «История» + `SessionMini` по `history`. Тап → `onSession`.
   - **Заметки:** 2 демо-`GlassCard` (дата + бейдж «Приватная» + текст), тап →
     `onNote(c, history[i])`; снизу пунктирная кнопка «+ Добавить заметку» →
     `onNote(c, upcoming)`.
   - **Документы:** список `DocRow` (4 шт., статус доставки signed/opened/
     missing с иконкой и датой) + зелёная кнопка «Отправить документ» → лист `doc`.
5. **Липкая панель** (градиент-fade снизу): `PrimaryButton(calendar)`
   «Записать сессию» → `onSession(upcoming)` + квадратная `GhostButton(note)` →
   `onNote(c, upcoming)`.
6. Листы: `msg`→`SendMessageSheet`, `invite`→`InviteSheet`, `doc`→`SendDocumentSheet`.

---

## 5. SessionDetail (сессия, push) → `presentation/session/SessionDetailScreen.kt`

**Шелл:** `PushScreen(title="Сессия")`. **Данные:** `c=client(s)`, статус, формат.

**Раскладка (порядок важен — заметки ВЫШЕ напоминаний):**
1. **`GlassCard(strong)` — шапка сессии:** ряд [eyebrow «Четверг, 11 июня» +
   крупное время `38/700 tnum` + длительность] … `StatusPill` справа; ниже —
   кликабельная плитка клиента (`Sage50`, аватар 46 + имя + «{tag} · с {since}»
   + chevR → `onClient(c)`); ниже два `InfoChip` (Формат / Оплата «Ожидает»).
2. **SectionTitle «Заметки сессии»** (действие «Открыть» → `onNote`). Карточка-
   превью: золотая вертикальная полоска + текст цели + теги `#тревога #КПТ`.
   Тап → `onNote(c,s)`. **Это главный, заметный блок.**
3. **`RemindersCard` — СВЁРНУТА по умолчанию** (`mutableStateOf(false)`):
   - Свёрнутый вид: [bell] «Напоминания клиенту» + строка-резюме
     («Уходят автоматически · 2 напоминания» или «Клиент не в боте — отправьте
     вручную») + зелёный бейдж «Авто» + шеврон.
   - Тап по шапке → разворот (`AnimatedVisibility`, шеврон поворот 90°): подзаголовок
     + лента `ReminderTimelineRow` ×2.
   - Каждая строка: точка статуса + линия слева; «За 24 часа / Завтра · 09:00»;
     текст; мета-чипы [статус][канал][QR оплаты если payment]; кнопки
     «Отправить ещё раз»(replay)→лист msg и «Вручную»(attach)→лист msg.
   - Статусы напоминаний (`REM_STATUS`): scheduled(Accent,clock) ·
     sent(Forest600,check) · read(Success,eye) · failed(Red,alert). Если
     `bound=false` — все как `scheduled`, кнопка «Отправить».
   - Вариант ленты `timeline` / `cards` — переключаемо (в прототипе это Tweak;
     в Android оставь `timeline`, `cards` опционально).
4. **Липкая панель (2 ряда):**
   - ряд 1: `PrimaryButton(video)` «Подключиться» + `GhostButton(send)`→лист msg
     + `GhostButton(note)`→`onNote`.
   - ряд 2: `GhostButton(clock)` «Перенести» + `GhostButton(x, danger)` «Отменить».

---

## 6. NoteEditor (заметка после сессии, push) → `presentation/notes/PostSessionNoteScreen.kt`

**Состояние:** `mode` (short|blocks|voice), `vals` (поля блоков + short),
`tags` (старт `["тревога","КПТ"]`).

**Раскладка:**
1. **`GlassTintCard`** контекст: `Avatar 44 ring` + имя + «{время · 50 мин} · {tag}».
2. **Баннер приватности** (Sage, shieldCheck): «Приватная заметка — клиент её
   не видит. Хранится только у вас».
3. eyebrow «Как зафиксировать» + сегмент **Кратко / По блокам / Голосом**
   (с иконками edit/note/mic).
4. Тело:
   - **blocks**: 5 полей `NoteField` — Запрос · Наблюдение · Интервенция ·
     Динамика · Следующий шаг (каждое — стеклянная карточка с заголовком и
     textarea-плейсхолдером-подсказкой).
   - **short**: одно большое поле «Заметка».
   - **voice**: `VoiceCapture` — круглая кнопка-микрофон (тап → запись/стоп,
     красный градиент в записи + анимация «волны»), подпись «Запишите голосом».
5. eyebrow «Теги» + ряд тегов-пилюль с «×» (удаление) + пунктирная «+ тег».
6. **Карточка AI-помощника** (золотистая, spark): «После сохранения сделает
   резюме, теги и подготовку к следующей сессии».
7. **Липкая панель:** `GhostButton` «Позже» + `PrimaryButton(check)`
   «Сохранить заметку». Обе → `onBack`.

> Существующий `NotesScreen.kt` (лента «Последние сессии» со скрина с кнопками
> «Добавить») — это отдельный таб-список. Приведи его строки к стеклянному виду
> (`GlassCard` + `Avatar` + дата/время + кнопка «Добавить» → открыть NoteEditor).
> Но в доке прототипа 4 таба (Сегодня/Календарь/Клиенты/Профиль) — «Заметки» и
> «…» из текущего дока убрать, заметки доступны из карточек клиента и сессии.
> **Уточни у владельца, если в реальном приложении 5 табов** — но дизайн-эталон
> = 4 таба + FAB.

---

## 7. Profile / Settings (Профиль) → `presentation/settings/SettingsScreen.kt`

**Раскладка (`compas-app.jsx → ProfileScreen`):**
1. Header: eyebrow «Аккаунт» + `tHero` «Профиль».
2. **`GlassTintCard`**: аватар «НП» + «Никита Петров» + «Психолог · КПТ,
   схема-терапия».
3. Ряд 3 `Kpi`: 24 клиента / 312 сессий / 4.9 рейтинг.
4. **SectionTitle «Автонапоминания»** + `GlassCard` с 4 `SettingToggle`
   (тумблеры, дефолт вкл): Подтверждение за 24ч (+QR) · Напоминание за 1–2ч ·
   Запрос оплаты · Согласие при первой записи (152-ФЗ). Снизу пояснение.
5. **«Оплата»**: `GlassCard` с `QrBox` + «QR и ссылка оплаты» + ссылка
   `cmpas.ru/pay/nikita`.
6. **«Мессенджеры и данные»**: `ConnRow` Telegram «Подключён ✓», MAX
   «Подключён ✓», далее 4 строки-настройки (Документы 152-ФЗ, Расписание,
   Тарифы, Общие) с chevR.

Тумблеры реально переключают состояние (`mutableStateOf`).

---

## 8. FAB-лист «Быстрое действие» → `presentation/actions/QuickActionScreen.kt`

`NewActionSheet` (`compas-app.jsx`): `CompasBottomSheet`, заголовок «Быстрое
действие» / «Что хотите сделать?». Сетка 2×2 `QuickAction`:
- Записать сессию (calendar, Forest700) · Новый клиент (user, Blue) ·
  Написать клиенту (send, Tg) · Отправить документ (doc, Accent).
Ниже eyebrow «Быстрый выбор клиента» + 4 строки активных клиентов
(`Avatar` + имя + тег + `ChannelChip`), тап → открыть `ClientDetail`.

---

## 9. Листы коммуникаций → `presentation/comms/`

- **SendMessageSheet:** `ChannelChip`; textarea; 4 шаблона (`MSG_TEMPLATES`,
  тап подставляет текст); если `bound=false` — жёлтая плашка «бот не может писать
  первым» + кнопка «Подготовить» (вместо «Отправить»). Отправка → экран
  `SentState` (галочка «Отправлено» / attach «Готово к отправке») → «Готово».
- **InviteSheet:** выбор Telegram/MAX (две кнопки-таба), строка-ссылка
  `cmpas.ru/i/{id}-{tg|mx}` + «7 дней», поясняющая плашка, `PrimaryButton`
  «Отправить приглашение» → `SentState(manual)`.
- **SendDocumentSheet:** `ChannelChip`; список `DOC_TEMPLATES` (radio-выбор,
  выбранный — рамка Forest + галочка); если `requiresAck` — зелёная плашка про
  152-ФЗ; кнопка «Отправить»/«Подготовить» → `SentState`.

---

## 10. Иконки (lucide → Material Outlined)

Если не кладёшь lucide-вектора, маппинг ближайших `Icons.Outlined.*`:
home→Home, calendar→CalendarMonth, users→Groups, user→Person,
plus→Add, clock→Schedule, video→Videocam, phone→Call, pin→LocationOn,
bell→NotificationsNone (badge → NotificationsActive), search→Search,
send→Send, note→Description/EditNote, edit→Edit, mic→Mic, attach→AttachFile,
replay→Replay, eye→Visibility, check→Check, x→Close, shieldCheck→VerifiedUser,
ruble→CurrencyRuble, book→MenuBook, doc→Description, wallet→Wallet,
link→Link, filter→Tune, flag→Flag, spark→AutoAwesome, scan→QrCode2,
chevR→ChevronRight, chevL→ChevronLeft, more→MoreHoriz, alert→WarningAmber,
checkCircle→CheckCircle.

→ Дальше: `03-interactions.md` — чек-лист каждой кнопки.
