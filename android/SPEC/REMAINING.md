# Android glass redesign — ОСТАВШАЯСЯ РАБОТА (handoff)

Этот файл — точный список того, что **ещё не сделано** по `android/SPEC/`, чтобы
продолжить работу другим агентом. Сделанное (фундамент + Dock + Today + Clients +
Calendar) уже в ветке `claude/explore-project-Uc2iK` (PR #39) и **собирается зелёным
в CI**.

---

## 0. Как проверять (важно)

- **Локально Android НЕ собирается** — в окружении нет Android SDK и нет
  `gradlew`. Единственная проверка компиляции — **CI на pull_request**
  (`.github/workflows/android-build.yml` уже триггерится на PR и собирает APK
  **без релиза**). Workflow: пуш в ветку → смотреть job «Build APK» → шаг
  «Build Debug APK».
- Мержить в `main` **только когда всё готово** — пуш в `main` публикует APK
  пользователям.
- Кодстайл/паттерны брать из уже готовых экранов: `dashboard/DashboardScreen.kt`,
  `clients/ClientsScreen.kt`, `calendar/CalendarScreen.kt`.

## 1. Готовый фундамент (переиспользовать, НЕ переписывать)

**`presentation/theme/`**
- Цвета: `Forest700/800/900`, `Sage*`, `CompasBg/Fg/Muted/MutedFg/Border/Accent/
  Accent400/Destructive`, статусы `Blue/Violet/Orange/Red/Success` (+`*Soft`),
  каналы `Tg/Max/Gold` (+`*Soft`). Хелперы `Color.shade(p)`, `Color.withAlpha(a)`.
- Типошкала: `tHero, tSection, tKpi, tBody, tBody2, tMeta, tEyebrow, tNum`.
- Стекло: `Modifier.glass(strong, radius)`, `Modifier.glassTint(radius)`,
  `Modifier.glassDock(radius)`, `@Composable Modifier.pressScale(interactionSource)`,
  `@Composable Ambient()`.
- Шрифт **Geist пока не подключён** — `CompasType.kt` использует `FontFamily.Default`.

**`presentation/components/`**
- `GlassCard`, `GlassTintCard` (оба с `padding`, `onClick`), `IconButtonGlass(icon,
  badge, onClick)`, `Kpi(icon, value, label, accent, modifier)`, `Eyebrow(text)`,
  `SectionTitle(title, actionLabel, onAction)`.
- `PrimaryButton(text, onClick, icon)`, `GhostButton(text?, onClick, icon, danger)`
  (text=null + sized modifier = квадратная иконочная), `CompasSegmented(options,
  selectedIndex, onSelect)`.
- `Avatar(name, size, ring)` — сквиркл, цвет из `avatarColor(name)`.
- `StatusPill(status: String | SessionStatus)`, `ChannelChip(channel, bound)`,
  `FmtChip(fmt)` (fmt: "video"|"phone"|"offline").
- `GlassDock(tabs, activeKey, onTab, onFab)`, `DockTab`, `CompasBottomSheet(onClose){}`,
  `SheetHead(title, sub)`, `NewActionSheet(...)`.

**Паттерн экрана:**
```kotlin
Box(Modifier.fillMaxSize().background(CompasBg)) {
    Ambient()
    LazyColumn(
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) { /* ... */ }
}
```
**Кликабельность с press-scale:**
```kotlin
val i = remember { MutableInteractionSource() }
Modifier.pressScale(i).<visual>.clickable(interactionSource = i, indication = null, onClick = ...)
```

---

## 2. ЧТО НЕ СДЕЛАНО

### 2.1. ClientDetail (push) — `presentation/clients/ClientDetailScreen.kt`
SPEC: `02-screens.md §4`, интеракции `03 §ClientDetail`. ВМ: `ClientDetailViewModel`.
> ⚠️ Файл импортирует `CompasSegmentedControl` из пакета calendar — он сохранён как
> обёртка над `CompasSegmented` в `CalendarScreen.kt`. Можно заменить на `CompasSegmented`.
Нужно (на реальных данных `ClientDetail`):
- Шелл push: стеклянная шапка [‹ назад][title][⋯]; контент скроллится; **липкая
  нижняя панель** (PrimaryButton «Записать сессию» + квадратный GhostButton-заметка).
- Hero `GlassTintCard`: Avatar 62 ring + имя + тег-пилюля + «с {since}».
- `MessengerStatusRow` (стекло): канал + статус; кнопка «Написать» (если bound) →
  лист msg, иначе «Пригласить» → лист invite.
- `CompasSegmented` Обзор/Записи/Заметки/Документы + содержимое каждой вкладки
  (см. §4): StatusMini-ряд, баннер согласия → лист doc, «Фокус работы», SessionMini,
  история, заметки, DocRow + «Отправить документ».

### 2.2. SessionDetail (push) — `presentation/session/SessionDetailScreen.kt`
SPEC: `02-screens.md §5`, интеракции `03 §SessionDetail`.
> `RemindersCard.kt` (свёрнутая карточка напоминаний) и `SessionReminderFactory.kt`
> (`buildReminders`) **уже есть и работают** — переиспользовать.
Нужно: переписать на стекло — `GlassCard(strong)` шапка сессии (eyebrow + крупное
время `tKpi tnum` + `StatusPill` + плитка клиента `Sage50` → ClientDetail + 2 InfoChip);
блок «Заметки сессии» (золотая полоса + теги) **ВЫШЕ** напоминаний; липкая панель
в 2 ряда (Подключиться/Написать/Заметка ; Перенести/Отменить-danger).

### 2.3. NoteEditor (push) — `presentation/notes/PostSessionNoteScreen.kt`
SPEC: `02-screens.md §6`, интеракции `03 §NoteEditor`.
Нужно: `GlassTintCard` контекст; баннер приватности (Sage); `CompasSegmented`
Кратко/По блокам/Голосом; тела режимов (5 полей NoteField / одно поле / VoiceCapture
с анимацией волн); теги-пилюли с «×» + «+ тег»; золотая AI-карточка; липкая панель
(GhostButton «Позже» + PrimaryButton «Сохранить заметку»). Состояние полей хранить
при смене режима.

### 2.4. Profile — `presentation/settings/SettingsScreen.kt`
SPEC: `02-screens.md §7`, интеракции `03 §Profile`.
Нужно: header eyebrow «Аккаунт» + `tHero`; `GlassTintCard` (аватар + имя + роль);
ряд 3 `Kpi`; «Автонапоминания» — `GlassCard` + 4 рабочих тумблера (`mutableStateOf`);
блок «Оплата» (QrBox + ссылка); «Мессенджеры и данные» (ConnRow Telegram/MAX + 4
строки-настройки с chevron). Тумблеры реально переключаются.

### 2.5. Листы коммуникаций — НОВЫЙ пакет `presentation/comms/`
SPEC: `02-screens.md §9`, интеракции `03 §Листы`. Все на `CompasBottomSheet`.
- `SendMessageSheet`: `ChannelChip` + textarea + 4 шаблона (тап подставляет текст);
  если `bound=false` — жёлтая плашка «бот не пишет первым» + кнопка «Подготовить»
  (вместо «Отправить»); отправка → `SentState` → «Готово».
- `InviteSheet`: табы Telegram/MAX + строка-ссылка + плашка + «Отправить приглашение».
- `SendDocumentSheet`: `ChannelChip` + radio-список `DOC_TEMPLATES` (рамка+галка) +
  плашка 152-ФЗ для `requiresAck` + «Отправить»/«Подготовить» → `SentState`.
- `SentState`: экран-подтверждение «Отправлено»/«Готово к отправке» + «Готово».
Подключить эти листы к кнопкам в ClientDetail и SessionDetail.

### 2.6. FAB-лист — быстрый выбор клиента
`presentation/actions/NewActionSheet.kt` сейчас содержит только сетку 2×2.
Добавить (SPEC `02 §8`): eyebrow «Быстрый выбор клиента» + 4 строки активных
клиентов (Avatar + имя + `ChannelChip`), тап → ClientDetail. И развести действия
«Написать клиенту»/«Отправить документ» на выбор клиента → нужный лист (сейчас они
просто открывают вкладку Клиенты как заглушку).

### 2.7. NotesScreen (лента) — `presentation/notes/NotesScreen.kt`
Рескин под стекло (`GlassCard` + `Avatar` + дата/время + «Добавить» → NoteEditor).
Из дока убран (теперь 4 таба), но экран доступен из карточек.

### 2.8. Geist шрифт
Положить `geist_regular/medium/semibold/bold/extrabold.ttf` в `app/src/main/res/font/`,
завести `FontFamily` и заменить `private val Sans = FontFamily.Default` в
`presentation/theme/CompasType.kt`. (Бинарники шрифта недоступны в текущем окружении.)

### 2.9. Календарь — доработки (опционально)
Сейчас MONTH = сетка + агенда дня; DAY/WEEK/LIST = агенда. По SPEC `02 §2` можно
доразвести День/Неделя.

---

## 3. Грабли (знать заранее)
- **Rebase-дубли:** ранее `ReminderStatus`/`SessionReminder`/`buildReminders`
  задвоились при rebase и валили компиляцию. Каноничные версии: `Models.kt`
  (один блок) и `SessionReminderFactory.kt`. Не плодить копии в ViewModel.
- В `git rebase` `--theirs` = **ваш** коммит (не main). Проверять дубли после.
- Не вешать `clickable` поверх `pointerInput`-press: использовать общий
  `interactionSource` (паттерн выше), иначе клики «съедаются».
- Warnings (неиспользуемые импорты) сборку НЕ валят — `allWarningsAsErrors` нет.
