# КОМПАС — Шпаргалка по дизайну

## 🎨 Основные цвета
```css
Primary (зелёный):    #1a4d3a
Accent (золото):      #c9a961
Background (молочный): #faf8f5
Destructive (красный): #d4183d
```

## 🔤 Типографика
- **Шрифт**: Системный (-apple-system, BlinkMacSystemFont)
- **Веса**: 400 (normal), 500 (medium)
- **Базовый размер**: 16px (14px на ≤375px)

## 📏 Spacing
```tsx
p-2 = 8px    p-3 = 12px    p-4 = 16px    p-6 = 24px
```

## 🔘 Border Radius
```tsx
rounded-md = 4px    rounded-lg = 6px    rounded-xl = 10px    rounded-2xl = 16px
```

## 🎯 Частые паттерны

### Карточка
```tsx
<div className="bg-card border border-border rounded-lg p-4 shadow-sm">
```

### Кнопка Primary
```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2">
```

### Кнопка Secondary
```tsx
<button className="border border-border hover:bg-muted rounded-lg px-4 py-2">
```

### Вторичный текст
```tsx
<p className="text-muted-foreground text-sm">
```

### Список iOS-стиль
```tsx
<div className="divide-y divide-border">
  <button className="w-full px-4 py-3 hover:bg-muted/50 active:bg-muted">
```

### Модал (мобильный)
```tsx
<div className="fixed inset-x-0 bottom-0 bg-card rounded-t-2xl animate-in slide-in-from-bottom">
```

### Иконка с фоном
```tsx
<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
  <Icon className="w-4 h-4 text-primary" />
</div>
```

## 📱 Адаптивность
```tsx
className="p-2 md:p-4"              // Отступы
className="text-sm md:text-base"    // Текст
className="grid-cols-1 md:grid-cols-2" // Сетка
```

## 🎨 Состояния
```tsx
hover:bg-muted/50
active:bg-muted
focus-visible:ring-2 focus-visible:ring-ring
disabled:opacity-50 disabled:pointer-events-none
```

## 🌈 Цветовые роли
```tsx
/* Фоны */
bg-background      // Основной фон
bg-card           // Карточки
bg-muted          // Приглушённый
bg-secondary      // Вторичный

/* Текст */
text-foreground          // Основной
text-muted-foreground    // Вторичный
text-accent             // Акцент
text-primary            // Primary

/* Границы */
border-border
divide-border
divide-border/50  // Тонкие
```

## ⚡ Быстрые классы
```tsx
/* Центрирование */
flex items-center justify-center

/* Стек */
flex flex-col gap-2

/* Горизонтальный список */
flex gap-2 overflow-x-auto

/* Полная ширина */
w-full

/* Скрыть скроллбары */
overflow-auto scrollbar-none

/* Адаптивная высота viewport */
h-screen md:h-auto
```

## 🎭 Анимации
```tsx
animate-in fade-in duration-200
animate-in slide-in-from-bottom duration-300
transition-all
transition-colors
```

## 🔒 Safe Areas (Telegram)
```tsx
safe-top safe-bottom safe-left safe-right
```

## 📊 Статусы сессий
```tsx
confirmed:  bg-primary
completed:  bg-muted-foreground/40
pending:    bg-accent
cancelled:  bg-destructive
```

## 🎨 Sidebar
```tsx
bg-sidebar (= #1a4d3a)
text-sidebar-foreground (= #faf8f5)
bg-sidebar-primary (= #c9a961) // Активный элемент
```

## ⚙️ shadcn/ui компоненты
Используйте готовые компоненты из `/src/app/components/ui/`:
- button, card, dialog, dropdown-menu, input, label
- select, switch, tabs, textarea, tooltip, badge
- sheet, sidebar, accordion, alert-dialog
- toast (sonner)

## 💡 Лучшие практики
1. ✅ Используйте CSS переменные (`bg-primary` не `bg-[#1a4d3a]`)
2. ✅ Mobile-first (`p-2 md:p-4`)
3. ✅ Touch-friendly размеры (min 44x44px)
4. ✅ Семантические классы (`text-muted-foreground` не `text-gray-500`)
5. ✅ Тонкие прозрачности (`/50`, `/10`)
6. ✅ iOS-стиль списков и модалов
