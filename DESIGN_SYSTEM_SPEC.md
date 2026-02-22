# КОМПАС — Полная спецификация дизайн-системы

## 📋 Обзор

**Название**: КОМПАС — система онлайн-записи к психологу  
**Платформы**: Веб-приложение (cmpas.ru) + Telegram MiniApp  
**Дизайн-философия**: iOS-стиль — лаконичный, красивый и функциональный  
**Технологический стек**: React 18.3.1 + Tailwind CSS 4.1.12 + shadcn/ui (Radix UI)

---

## 🎨 Цветовая палитра

### Основные цвета бренда
```css
--primary: #1a4d3a         /* Основной зелёный — глубокий, благородный */
--accent: #c9a961          /* Золотистый акцент — тёплый, премиальный */
--background: #faf8f5      /* Светлый фон — мягкий, молочный */
```

### Светлая тема (по умолчанию)

#### Фоны и поверхности
```css
--background: #faf8f5           /* Основной фон приложения */
--card: #ffffff                 /* Фон карточек, модалов */
--popover: #ffffff              /* Фон всплывающих окон */
--secondary: #f5f2ed            /* Вторичный фон для выделения зон */
--muted: rgba(26, 77, 58, 0.05) /* Приглушённый фон (5% прозрачность primary) */
--input-background: #ffffff     /* Фон полей ввода */
```

#### Текст и иконки
```css
--foreground: #1a4d3a                   /* Основной текст */
--card-foreground: #1a4d3a              /* Текст на карточках */
--muted-foreground: rgba(26, 77, 58, 0.6) /* Вторичный текст (60% прозрачность) */
--primary-foreground: #ffffff           /* Текст на primary фоне */
--accent-foreground: #ffffff            /* Текст на accent фоне */
--secondary-foreground: #1a4d3a         /* Текст на secondary фоне */
```

#### Функциональные цвета
```css
--primary: #1a4d3a              /* Кнопки, активные элементы */
--accent: #c9a961               /* Акценты, быстрые действия, новые функции */
--destructive: #d4183d          /* Удаление, отмена, ошибки */
--destructive-foreground: #ffffff

--border: rgba(26, 77, 58, 0.1) /* Границы (10% прозрачность primary) */
--ring: #c9a961                 /* Фокус, outline (золотистый) */
```

#### Боковая панель (Sidebar)
```css
--sidebar: #1a4d3a                      /* Фон сайдбара — тёмно-зелёный */
--sidebar-foreground: #faf8f5           /* Текст в сайдбаре — светлый */
--sidebar-primary: #c9a961              /* Активная навигация — золотистый */
--sidebar-primary-foreground: #1a4d3a   /* Текст на активной навигации */
--sidebar-accent: rgba(255, 255, 255, 0.1) /* Hover состояние */
--sidebar-accent-foreground: #ffffff
--sidebar-border: rgba(255, 255, 255, 0.1) /* Разделители в сайдбаре */
--sidebar-ring: #c9a961                 /* Фокус в сайдбаре */
```

#### Графики и визуализации
```css
--chart-1: #1a4d3a  /* Основной зелёный */
--chart-2: #c9a961  /* Золотистый */
--chart-3: #2d7a5e  /* Средний зелёный */
--chart-4: #e8d4a8  /* Светлое золото */
--chart-5: #a58847  /* Тёмное золото */
```

### Тёмная тема
```css
.dark {
  --background: #0f1f18               /* Очень тёмный зелёный */
  --foreground: #faf8f5               /* Светлый текст */
  --card: #1a4d3a                     /* Карточки — primary цвет */
  --card-foreground: #faf8f5
  --popover: #1a4d3a
  --popover-foreground: #faf8f5
  --primary: #c9a961                  /* В тёмной теме primary — золотистый */
  --primary-foreground: #1a4d3a
  --secondary: rgba(255, 255, 255, 0.1)
  --secondary-foreground: #faf8f5
  --muted: rgba(255, 255, 255, 0.1)
  --muted-foreground: rgba(250, 248, 245, 0.6)
  --accent: #c9a961
  --accent-foreground: #1a4d3a
  --destructive: #d4183d
  --destructive-foreground: #ffffff
  --border: rgba(255, 255, 255, 0.1)
  --input: rgba(255, 255, 255, 0.05)
  --ring: #c9a961
  
  /* Charts для тёмной темы */
  --chart-1: #c9a961
  --chart-2: #2d7a5e
  --chart-3: #e8d4a8
  --chart-4: #a58847
  --chart-5: #faf8f5
}
```

---

## 🔤 Типографика

### Семейство шрифтов
```css
/* Используется системный шрифт iOS/macOS для нативного вида */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Важно**: Пользовательские шрифты не подключены. Приложение использует системные шрифты для:
- Мгновенной загрузки
- Нативного iOS-ощущения
- Оптимизации производительности в Telegram MiniApp

### Базовый размер
```css
html {
  font-size: 16px; /* Базовый размер для десктопа */
}

@media (max-width: 375px) {
  html {
    font-size: 14px; /* Адаптивное уменьшение для маленьких экранов */
  }
}
```

### Начертания
```css
--font-weight-normal: 400  /* Обычный текст, инпуты */
--font-weight-medium: 500  /* Заголовки, кнопки, лейблы */
```

### Стандартные стили HTML элементов

#### Заголовки
```css
h1 {
  font-size: var(--text-2xl);  /* 2xl */
  font-weight: 500;
  line-height: 1.5;
}

h2 {
  font-size: var(--text-xl);   /* xl */
  font-weight: 500;
  line-height: 1.5;
}

h3 {
  font-size: var(--text-lg);   /* lg */
  font-weight: 500;
  line-height: 1.5;
}

h4 {
  font-size: var(--text-base); /* base (16px) */
  font-weight: 500;
  line-height: 1.5;
}
```

#### Текстовые элементы
```css
label, button {
  font-size: var(--text-base);
  font-weight: 500;
  line-height: 1.5;
}

input, textarea {
  font-size: var(--text-base);
  font-weight: 400;
  line-height: 1.5;
}

p {
  /* Наследует базовые стили body */
}
```

**Примечание**: Tailwind утилиты (`text-sm`, `text-lg` и т.д.) автоматически переопределяют эти базовые стили.

---

## 📐 Отступы и скругления

### Border Radius (iOS-стиль)
```css
--radius: 0.375rem; /* 6px — базовое значение */

/* Доступные варианты */
--radius-sm: calc(var(--radius) - 4px);  /* 2px */
--radius-md: calc(var(--radius) - 2px);  /* 4px */
--radius-lg: var(--radius);              /* 6px */
--radius-xl: calc(var(--radius) + 4px);  /* 10px */
```

**Применение**:
- Кнопки: `rounded-md` или `rounded-lg`
- Карточки: `rounded-lg` или `rounded-xl`
- Модалы на мобильных: `rounded-t-2xl` (16px) для iOS bottom sheet
- Инпуты: `rounded-lg`

### Spacing система
Используется стандартная шкала Tailwind CSS:
- `p-1` = 0.25rem (4px)
- `p-2` = 0.5rem (8px)
- `p-3` = 0.75rem (12px)
- `p-4` = 1rem (16px)
- `p-6` = 1.5rem (24px)
- `p-8` = 2rem (32px)

**iOS-паттерн отступов**:
- Внутренние отступы карточек: `p-4` (16px)
- Отступы между элементами в списках: `gap-2` или `gap-3`
- Внешние отступы от экрана: `p-2 md:p-4`

---

## 🧩 Компоненты shadcn/ui

### Установленные компоненты
Приложение использует **shadcn/ui** (на базе Radix UI):

```
accordion, alert-dialog, alert, aspect-ratio, avatar, badge, 
breadcrumb, button, calendar, card, carousel, chart, checkbox, 
collapsible, command, context-menu, dialog, drawer, dropdown-menu, 
form, hover-card, input-otp, input, label, menubar, navigation-menu, 
pagination, popover, progress, radio-group, resizable, scroll-area, 
select, separator, sheet, sidebar, skeleton, slider, sonner (toast), 
switch, table, tabs, textarea, toggle-group, toggle, tooltip
```

### Ключевые настройки компонентов

#### Button варианты
```tsx
variant:
  - default: bg-primary text-primary-foreground hover:bg-primary/90
  - destructive: bg-destructive text-white hover:bg-destructive/90
  - outline: border bg-background hover:bg-accent hover:text-accent-foreground
  - secondary: bg-secondary text-secondary-foreground hover:bg-secondary/80
  - ghost: hover:bg-accent hover:text-accent-foreground
  - link: text-primary underline-offset-4 hover:underline

size:
  - default: h-9 px-4 py-2
  - sm: h-8 px-3
  - lg: h-10 px-6
  - icon: size-9 (квадратная кнопка)
```

#### Состояния фокуса
```css
/* Все интерактивные элементы */
outline: none;
focus-visible:border-ring;
focus-visible:ring-ring/50;
focus-visible:ring-[3px];
```

#### Анимации
Подключена библиотека `tw-animate-css` для плавных переходов:
```tsx
/* Примеры классов */
animate-in
fade-in
slide-in-from-bottom
duration-200
```

---

## 📱 Telegram MiniApp адаптация

### Safe Areas (iOS notch)
```css
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-left { padding-left: env(safe-area-inset-left); }
.safe-right { padding-right: env(safe-area-inset-right); }
```

### Bottom Sheet модалы
```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  border-radius: 16px 16px 0 0;  /* Скругление только сверху */
  max-height: 90vh;
  animation: slideUp 0.3s ease-out;
}
```

### Тактильная обратная связь
```css
.haptic-light:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}
```

### Touch-friendly размеры
```css
@media (hover: none) and (pointer: coarse) {
  button, a[role="button"] {
    min-height: 44px;  /* Минимальный размер для тач-целей (Apple HIG) */
    min-width: 44px;
  }
}
```

### Скрытие скроллбаров
```css
@media (max-width: 768px) {
  .telegram-miniapp-scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .telegram-miniapp-scrollbar-hide {
    scrollbar-width: none;
  }
}
```

### Высота viewport
```css
.mobile-full-height {
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height для мобильных браузеров */
}
```

### Предотвращение pull-to-refresh
```css
body {
  overscroll-behavior-y: contain;
}
```

---

## 🎯 Правила верстки и UI паттерны

### iOS-стиль компонентов

#### 1. **Списки событий (расписание)**
```tsx
/* Структура: */
<div className="divide-y divide-border/50">
  {/* Заголовок секции */}
  <div className="px-4 py-3 sticky top-0 bg-background z-10">
    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
      СЕГОДНЯ
    </h3>
  </div>
  
  {/* Элемент списка */}
  <button className="w-full px-4 py-3 hover:bg-muted/50 active:bg-muted">
    {/* Контент */}
  </button>
</div>
```

#### 2. **Карточки**
```tsx
<div className="bg-card border border-border rounded-lg p-4 shadow-sm">
  {/* Контент карточки */}
</div>
```

#### 3. **Боковая панель (Sidebar)**
```tsx
/* Цвета */
background: var(--sidebar) = #1a4d3a
foreground: var(--sidebar-foreground) = #faf8f5
active: var(--sidebar-primary) = #c9a961
```

#### 4. **Статистические виджеты**
```tsx
<div className="flex gap-2 p-2 overflow-x-auto">
  <div className="flex-1 min-w-[70px] bg-card rounded-lg px-2 py-1.5 border">
    {/* Иконка + число */}
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded bg-primary/10">
        <Icon className="w-3 h-3 text-primary" />
      </div>
      <span className="text-lg font-semibold">{value}</span>
    </div>
    {/* Подпись */}
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
</div>
```

#### 5. **Быстрые действия (Quick Actions)**
```tsx
/* Иконки заметок, действий и т.д. */
<button className={`
  p-2 rounded-lg transition-all
  ${hasContent 
    ? "bg-accent/15 text-accent hover:bg-accent/25"  /* Если заполнено */
    : "text-muted-foreground hover:bg-muted hover:text-foreground"  /* Пусто */
  }
`}>
  <Icon size={18} />
</button>
```

#### 6. **Модальные окна**
**Десктоп**: Центрированный диалог
```tsx
<div className="fixed inset-0 flex items-center justify-center">
  <div className="bg-card rounded-2xl shadow-2xl max-w-2xl">
    {/* Контент */}
  </div>
</div>
```

**Мобильные**: Bottom sheet
```tsx
<div className="fixed inset-x-0 bottom-0 bg-card rounded-t-2xl">
  {/* Контент */}
</div>
```

#### 7. **Цветовые индикаторы статусов**
```tsx
const getStatusColor = (status: Session["status"]) => {
  switch (status) {
    case "confirmed":
      return "bg-primary";           // Зелёный
    case "completed":
      return "bg-muted-foreground/40"; // Серый
    case "pending":
      return "bg-accent";            // Золотистый
    case "cancelled":
      return "bg-destructive";       // Красный
  }
};
```

### Адаптивность

#### Брейкпоинты (Tailwind defaults)
```css
sm: 640px   /* Малые планшеты */
md: 768px   /* Планшеты и выше */
lg: 1024px  /* Десктоп */
xl: 1280px  /* Большие экраны */
```

#### Типичный паттерн
```tsx
<div className="p-2 md:p-4">           {/* Отступы */}
<div className="text-sm md:text-base"> {/* Размер текста */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"> {/* Сетка */}
```

### Иерархия z-index
```
Обычный контент: z-0
Sticky заголовки: z-10
Sidebar: z-20
Модалы overlay: z-50
Модалы содержимое: z-51
Toasts (sonner): z-[100] (по умолчанию)
```

---

## 🎨 Примеры использования цветов в UI

### Фоны
```tsx
/* Основной фон приложения */
className="bg-background"

/* Карточки, модалы */
className="bg-card"

/* Выделенные зоны */
className="bg-muted"
className="bg-secondary"

/* Hover состояния */
className="hover:bg-muted/50"
className="hover:bg-accent/10"
```

### Текст
```tsx
/* Основной текст */
className="text-foreground"

/* Вторичный/описательный текст */
className="text-muted-foreground"

/* Акцентный текст */
className="text-accent"
className="text-primary"
```

### Границы
```tsx
/* Стандартные границы */
className="border border-border"

/* Разделители */
className="divide-y divide-border"
className="divide-y divide-border/50"  /* Более тонкие */
```

### Иконки
```tsx
/* Обычные иконки */
<Icon className="w-4 h-4 text-muted-foreground" />

/* Акцентные иконки */
<Icon className="w-4 h-4 text-accent" />
<Icon className="w-4 h-4 text-primary" />
```

---

## 🔧 Tailwind CSS 4.x настройки

### Файловая структура
```
/src/styles/
  ├── index.css              # Главный файл (импорты)
  ├── tailwind.css           # Конфигурация Tailwind 4
  ├── theme.css              # Цветовые токены и базовые стили
  ├── fonts.css              # Импорты шрифтов (пустой)
  └── telegram-miniapp.css   # MiniApp специфичные стили
```

### tailwind.css
```css
@import 'tailwindcss' source(none);
@source '../**/*.{js,ts,jsx,tsx}';  /* Сканирование файлов */
@import 'tw-animate-css';           /* Анимации */
```

### theme.css — @theme inline
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  /* ... все токены */
  
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(--var(radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### @layer base стили
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
  
  /* ... typography стили h1-h4, label, button, input */
}
```

---

## 📦 Установленные библиотеки

### UI компоненты
- **Radix UI** — headless компоненты (все @radix-ui/react-*)
- **shadcn/ui** — компоненты на базе Radix UI
- **lucide-react** — иконки (0.487.0)
- **sonner** — toast уведомления (2.0.3)

### Функциональность
- **motion** (12.23.24) — анимации (бывший Framer Motion)
- **date-fns** (3.6.0) — работа с датами
- **react-day-picker** (8.10.1) — календарь
- **react-hook-form** (7.55.0) — формы
- **recharts** (2.15.2) — графики

### Утилиты
- **class-variance-authority** — варианты компонентов (cva)
- **clsx** — условные классы
- **tailwind-merge** — объединение Tailwind классов
- **tw-animate-css** — готовые анимации

### MUI (опционально используется)
```json
"@mui/material": "7.3.5"
"@mui/icons-material": "7.3.5"
"@emotion/react": "11.14.0"
"@emotion/styled": "11.14.1"
```

---

## 🚀 Рекомендации для разработки

### 1. **Всегда используйте CSS переменные**
```tsx
/* ✅ Правильно */
className="bg-primary text-primary-foreground"

/* ❌ Неправильно */
className="bg-[#1a4d3a] text-white"
```

### 2. **Соблюдайте iOS паттерны**
- Минимальные размеры touch-целей: 44x44px
- Bottom sheets для модалов на мобильных
- Sticky заголовки секций с uppercase текстом
- Тонкие разделители (`divide-border/50`)

### 3. **Адаптивность mobile-first**
```tsx
/* Базовый стиль для мобильных, md+ для десктопа */
className="p-2 md:p-4"
className="text-sm md:text-base"
```

### 4. **Используйте семантические токены**
```tsx
/* Вместо конкретных цветов используйте роли */
bg-card, bg-muted, bg-secondary
text-foreground, text-muted-foreground
border-border
```

### 5. **Прозрачности для визуальной иерархии**
```tsx
/* Тонкие эффекты */
bg-muted/50        /* 50% прозрачность */
bg-primary/10      /* 10% для фона под иконками */
text-foreground/60 /* Вторичный текст */
```

### 6. **Консистентные тени**
```tsx
/* Карточки */
shadow-sm   /* Лёгкая тень */
shadow-md   /* Средняя */
shadow-2xl  /* Модалы */
```

### 7. **Анимации с tw-animate-css**
```tsx
/* Появление элементов */
className="animate-in fade-in duration-200"
className="animate-in slide-in-from-bottom duration-300"
```

---

## 📝 Checklist для нового компонента

- [ ] Использует CSS переменные из theme.css
- [ ] Адаптивен (mobile-first подход)
- [ ] Touch-friendly размеры (min 44x44px для кнопок)
- [ ] Поддерживает тёмную тему (если применимо)
- [ ] Состояние фокуса (ring-ring, outline-ring)
- [ ] Плавные переходы (transition-all, transition-colors)
- [ ] iOS-стиль скруглений (rounded-lg, rounded-xl)
- [ ] Семантические классы (bg-card, text-foreground)
- [ ] Правильная иерархия z-index
- [ ] Telegram MiniApp safe areas (если нужно)

---

## 🎯 Ключевые принципы дизайна КОМПАС

1. **Минимализм** — только необходимые элементы
2. **Быстрота** — действия за 3-10 секунд
3. **Ясность** — визуальная иерархия через цвет и типографику
4. **Премиальность** — золотистый акцент (#c9a961) для важных действий
5. **Профессионализм** — зелёный (#1a4d3a) как основа доверия
6. **Лёгкость** — молочный фон (#faf8f5) для комфорта глаз
7. **Нативность** — iOS-паттерны для знакомого UX

---

## 📚 Полезные ссылки

- **Tailwind CSS 4.x**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Radix UI**: https://www.radix-ui.com
- **Lucide Icons**: https://lucide.dev
- **Apple HIG**: https://developer.apple.com/design/human-interface-guidelines/

---

**Версия документа**: 1.0  
**Дата**: 22 февраля 2026  
**Статус**: Актуальна для текущей кодовой базы
