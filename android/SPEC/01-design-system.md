# 01 · Дизайн-система и фундаментальные компоненты

Все значения взяты из палитры `C` в `compas-ui.jsx` и CSS в `index.html`.
**Палитра `C` из JSX — главная** (именно ею рендерится прототип).

---

## 1. Цвета → `presentation/theme/Color.kt`

```kotlin
package ru.cmpas.app.presentation.theme
import androidx.compose.ui.graphics.Color

// ── Лес (бренд) ─────────────────────────────────
val Forest900 = Color(0xFF123829)
val Forest800 = Color(0xFF163F2F)
val Forest700 = Color(0xFF1A4D3A)   // primary
val Forest600 = Color(0xFF2D7A5E)

// ── Шалфей (поверхности) ────────────────────────
val Sage50  = Color(0xFFF2F5EE)
val Sage100 = Color(0xFFE9EFE6)
val Sage150 = Color(0xFFE2E9DE)
val Sage200 = Color(0xFFD8E2D4)

// ── Семантика ───────────────────────────────────
val CompasPrimary     = Forest700
val CompasBg          = Color(0xFFFAF8F5)
val CompasFg          = Color(0xFF16271D)
val CompasMuted       = Color(0xFFF1F0E9)
val CompasMutedFg     = Color(0xFF5B6B61)
val CompasBorder      = Color(0xFFE7E3D9)
val CompasAccent      = Color(0xFFC9A961)   // золото
val CompasAccent400   = Color(0xFFD9C089)
val CompasDestructive = Color(0xFFD4183D)

// ── Статусы ─────────────────────────────────────
val Blue        = Color(0xFF2AABEE); val BlueSoft    = Color(0xFFE6F4FC)
val Violet      = Color(0xFF5B6CF0); val VioletSoft  = Color(0xFFECEEFD)
val Orange      = Color(0xFFD9913C); val OrangeSoft  = Color(0xFFFBF1E4)
val Red         = Color(0xFFD4183D); val RedSoft     = Color(0xFFFBE9EC)
val Success     = Color(0xFF2D7A5E); val SuccessSoft = Color(0xFFE8F1EC)

// ── Каналы-мессенджеры ──────────────────────────
val Tg  = Color(0xFF2AABEE); val TgSoft  = Color(0xFFE6F4FC)
val Max = Color(0xFF5B6CF0); val MaxSoft = Color(0xFFECEEFD)
val Gold = Color(0xFFC9A961); val GoldSoft = Color(0xFFF7F1E2)
```

`MaterialTheme.colorScheme`: `primary=Forest700`, `onPrimary=White`,
`background=CompasBg`, `surface=White`, `onSurface=CompasFg`,
`onSurfaceVariant=CompasMutedFg`, `outlineVariant=CompasBorder`,
`error=CompasDestructive`, `primaryContainer=Sage100`.

Хелперы (перенести 1:1 из `compas-ui.jsx`):
```kotlin
fun Color.shade(p: Int): Color { /* как shade(hex,p): сдвиг RGB на p, clamp 0..255 */ }
fun Color.alpha(a: Float): Color = this.copy(alpha = a)   // аналог hexA(hex,a)
```

---

## 2. Типографика → `presentation/theme/Type.kt`

Шрифт **Geist**. `FontFamily(Font(R.font.geist_regular, W400) … geist_extrabold W800)`.

| Стиль (имя в проекте) | size / line / weight | letterSpacing | примечание |
|---|---|---|---|
| `tHero`     | 24 / 30 / 700 | -0.02em | заголовок экрана |
| `tSection`  | 19 / 25 / 600 | -0.01em | заголовок секции |
| `tKpi`      | 30 / 32 / 700 | -0.02em | число KPI (на дашборде 24/26) · tabular nums |
| `tBody`     | 15 / 21 / 500 | — | основной |
| `tBody2`    | 14 / 20 / 450 | — | цвет `CompasMutedFg` |
| `tMeta`     | 12 / 15 / 600 | 0.01em | мета |
| `tEyebrow`  | 11 / 14 / 700 | 0.07em | **UPPERCASE**, цвет `CompasMutedFg` |

Числа (время, суммы, даты, числа календаря) — `tabular nums`
(`fontFeatureSettings = "tnum"`).

---

## 3. Радиусы, отступы, тени

```kotlin
object R { val sm=8.dp; val md=12.dp; val lg=16.dp; val xl=20.dp; val xxl=24.dp; val full=999.dp }
// Карточки = 22.dp; листы (верх) = 30.dp; кнопки = 14–16.dp; FAB = 22.dp; иконки-кнопки = 13–14.dp.
```
Экранные горизонтальные поля контента — **20 dp**. Низ скролла — **108 dp**
(чтобы док не перекрывал контент); на push-экранах с липкими кнопками — **130–150 dp**.

---

## 4. Стекло → `presentation/theme/Glass.kt`

CSS-рецепты (из `index.html`) и их Compose-эквивалент.

| Класс | bg (white alpha) | border | тень | где |
|---|---|---|---|---|
| `.glass` | 0.58 | 1dp white α0.62 | y8 blur30 `#142018` α0.07 | карточки |
| `.glass-strong` | 0.72 | 1dp white α0.70 | y12 blur34 α0.10 | календарь, листы |
| `.glass-tint` | градиент 155° `Forest700 α.92 → Forest900 α.96` | white α0.10 | y16 blur38 `#10281E` α0.34 | hero-карточки (тёмные) |
| `.glass-dock` | 0.66 | 1dp white α0.55 | y16 blur44 `#10281E` α0.20 | док |

```kotlin
// Базовая стеклянная поверхность (без Haze — полупрозрачный вариант).
fun Modifier.glass(
    strong: Boolean = false,
    radius: Dp = 22.dp,
): Modifier = this
    .shadow(if (strong) 18.dp else 14.dp, RoundedCornerShape(radius),
            ambientColor = Color(0x14142018), spotColor = Color(0x14142018))
    .clip(RoundedCornerShape(radius))
    .background(Color.White.copy(alpha = if (strong) 0.72f else 0.58f))
    .border(1.dp, Color.White.copy(alpha = if (strong) 0.70f else 0.62f),
            RoundedCornerShape(radius))
```
> **Если используешь Haze:** оберни корневой `Box` каждого экрана в
> `Modifier.haze(state)`, а стеклянным поверхностям дай `Modifier.hazeChild(state,
> shape, style=HazeStyle(blurRadius=22.dp, tint=White.copy(0.35f)))`. Это даёт
> настоящее размытие фонового `Ambient`-свечения сквозь карточки.

**`glass-tint` (тёмная карточка-герой):**
```kotlin
fun Modifier.glassTint(radius: Dp = 22.dp) = this
    .shadow(20.dp, RoundedCornerShape(radius), spotColor = Color(0x57102820))
    .clip(RoundedCornerShape(radius))
    .background(Brush.linearGradient(
        0f to Color(0xEB1A4D3A), 1f to Color(0xF5123829),   // α.92 → .96
        start = Offset(0f, 0f), end = Offset.Infinite))
    .border(1.dp, Color.White.copy(0.10f), RoundedCornerShape(radius))
```

**`Ambient` (фоновое свечение экрана):** Box на весь экран, под контентом:
два размытых радиальных пятна — зелёное вверху-слева
(`Forest600 α.40`, ~340dp, blur 48), золотое внизу-справа (`Accent α.32`),
плюс синее пятно по центру (`Blue α.14`). Реализуй через `drawBehind` с
`Brush.radialGradient` или картинки-блобы с `Modifier.blur(48.dp)`.

---

## 5. Glass-компоненты → `presentation/components/Glass.kt`

```kotlin
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    strong: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val base = modifier.glass(strong)
        .then(if (onClick != null) Modifier.pressScale().clickable(onClick = onClick) else Modifier)
    Column(base, content = content)
}

@Composable
fun GlassTintCard(modifier: Modifier = Modifier, onClick: (()->Unit)?=null,
                  content: @Composable ColumnScope.()->Unit) { /* glassTint + clickable */ }
```

`Modifier.pressScale()` — общий press-эффект `scale 0.975` на нажатии:
```kotlin
fun Modifier.pressScale(min: Float = 0.975f) = composed {
    val pressed = remember { mutableStateOf(false) }
    val s by animateFloatAsState(if (pressed.value) min else 1f, tween(120), label="press")
    this.graphicsLayer { scaleX = s; scaleY = s }
        .pointerInput(Unit) { detectTapGestures(
            onPress = { pressed.value = true; tryAwaitRelease(); pressed.value = false }) }
}
```

---

## 6. Плавающий док + FAB → `presentation/components/GlassDock.kt`

**Это критичный компонент (Баг B). Спека точная:**

- Контейнер: плавающая таблетка, `align = BottomCenter`, **отступ снизу 14 dp**,
  `padding(horizontal=14, vertical=9)`, `RoundedCornerShape(30.dp)`, стиль
  `.glass-dock`. Под доком виден контент (полупрозрачность важна).
- 4 таба: **Сегодня (home), Календарь (calendar), Клиенты (users), Профиль
  (user)**. Раскладка: 2 таба — **пустой зазор 62 dp под FAB** — 2 таба.
- `DockBtn`: ширина 58, высота 48; колонка `[иконка 22dp] [подпись 10.5sp]`,
  `gap 3`. Подпись **всегда видна**.
  - Активный: **за иконкой** пилюля-подложка 36×34 dp, радиус 14,
    `Forest700 α0.12` (рисуется в `Box` позади иконки, `zIndex` ниже текста — текст
    НИКОГДА не перекрывается). Иконка `Forest800` stroke 2.4, подпись `Forest800`
    700.
  - Неактивный: иконка/подпись `CompasMutedFg`, weight 600.
- **Центральный FAB** (`CenterFab`): 60×60 dp, `RoundedCornerShape(22.dp)`,
  граница `3.dp White α0.85`, фон — градиент `Forest700→Forest900` (150°),
  тень `Forest900 α0.42`, иконка `plus` 26dp белая stroke 2.6. Позиция —
  абсолютно по центру дока, приподнят (`translationY ≈ -8 dp`). `onClick` →
  открыть лист «Быстрое действие».

> **Распространённая ошибка, которую надо избежать:** не делать активный
> таб через `Modifier.border`/обводку иконки — именно из-за этого на скриншоте
> подписи спрятались. Только подложка-пилюля ПОЗАДИ иконки.

Иконки — lucide-стиль (контурные, stroke ~2.1–2.4). В Compose используем
`Icons.Outlined.*` Material-иконки как ближайшие аналоги (карта соответствий —
в `02-screens.md`, блок «Иконки»), либо кладём lucide-vektor-drawable в
`res/drawable/`.

---

## 7. Нижний лист → `presentation/components/CompasBottomSheet.kt`

```kotlin
@Composable
fun CompasBottomSheet(onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    // Полноэкранный Box: затемнение rgba(16,28,21,0.40) + blur(3dp) по тапу закрывает.
    // Контейнер снизу: glass-strong, RoundedCornerShape(topStart=30, topEnd=30),
    // padding(20, top=10, bottom=26), maxHeight ~720dp, вертикальный скролл.
    // Сверху — «ручка» 42×5 dp, CompasBorder, по центру.
    // Появление: slideUp + fade (tween 340, cubicBezier(.22,.61,.36,1)).
}
```
Можно базироваться на `ModalBottomSheet` Material3 с кастомным `containerColor`
и `shape`, но «ручка», заголовок `SheetHead(title, sub)` и стеклянный фон —
обязательны.

---

## 8. Кнопки, сегменты, аватар, статусы → `presentation/components/`

- **`PrimaryButton`**: высота 52, радиус 16, градиент `Forest700→Forest900`,
  белый текст 15.5/600, опц. иконка слева, тень `Forest900 α0.30`, press-scale.
- **`GhostButton`**: высота 52, стекло, текст `Forest800` (или
  `CompasDestructive` при `danger=true`) 15/600, опц. иконка.
- **`CompasSegmented`**: стеклянная дорожка (padding 4, радиус 15), внутри
  кнопки高 38; активная — градиент `Forest700→Forest800`, белый 700, тень;
  неактивная — прозрачная, `CompasMutedFg` 600. Анимация перехода 200мс.
- **`Avatar(c, size, ring)`**: квадрат со скруглением `size*0.34` (**сквиркл, не
  круг**), фон — градиент `c.color → shade(-16)`, инициалы белые `size*0.36` 700,
  тень `c.color α0.34`; при `ring` — белое кольцо `0 0 0 3dp White α0.7`.
- **`StatusPill(status)`**: пилюля `confirmed/pending/completed/cancelled` —
  точка + подпись (Подтверждена/Ожидает/Завершена/Отменена), мягкий фон. Карта:
  - confirmed: dot `Success`, soft `SuccessSoft`, fg `#256B40`
  - pending: dot `CompasAccent`, soft `#FBF3E2`, fg `#9A7322`
  - completed: dot `CompasMutedFg`, soft `CompasMuted`, fg `CompasMutedFg`
  - cancelled: dot `Red`, soft `RedSoft`, fg `#C24A3E`
- **`ChannelChip(channel, bound)`**: Telegram/MAX/«Не в боте». Привязан →
  мягкий фон канала + галочка; канал есть, но не открыт → «· не открыт».
- **`IconButtonGlass(icon, badge)`**: 42×42, радиус 14, стекло; `badge` —
  золотая точка вверху-справа.
- **`FmtChip(fmt)`**: видео/телефон/очно — иконка `Forest600` + подпись.
- **`InfoChip`, `StatusMini`, `Kpi`** — мелкие инфо-плитки (раскладки в `02`).

Формат-метаданные:
`video→{video,"Видео"}`, `phone→{phone,"Телефон"}`, `offline→{pin,"Очно"}`.

Дальше — `02-screens.md` (каждый экран) и `03-interactions.md` (каждая кнопка).
