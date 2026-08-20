/** Реестр экранов панели — единственный источник имён, маршрутов и номеров. */

export const PANEL_SCREENS = [
    { key: 'morning', no: 1, title: 'Утро', href: '/admin/panel/morning' },
    { key: 'money', no: 2, title: 'Деньги', href: '/admin/panel/money' },
    { key: 'products', no: 3, title: 'Продукты', href: '/admin/panel/products' },
    { key: 'funnel', no: 4, title: 'Путь и активация', href: '/admin/panel/funnel' },
    { key: 'retention', no: 5, title: 'Удержание', href: '/admin/panel/retention' },
    { key: 'tech', no: 6, title: 'Техника', href: '/admin/panel/tech' },
    { key: 'quality', no: 7, title: 'Качество данных', href: '/admin/panel/quality' },
    { key: 'components', no: 8, title: 'Библиотека компонентов', href: '/admin/panel/components' },
] as const;

export type ScreenKey = (typeof PANEL_SCREENS)[number]['key'];

/** Экраны с собственным API-маршрутом. «Библиотека компонентов» данных не читает. */
export const DATA_SCREENS = PANEL_SCREENS.filter((s) => s.key !== 'components');

export const PRODUCTS = [
    { key: 'practice', title: 'ПРАКТИКА', slot: 'c1' },
    { key: 'zapiski', title: 'ЗАПИСКИ', slot: 'c2' },
    { key: 'momenty', title: 'МОМЕНТЫ', slot: 'c3' },
] as const;

export type ProductKey = (typeof PRODUCTS)[number]['key'];

export function isProductKey(value: unknown): value is ProductKey {
    return PRODUCTS.some((p) => p.key === value);
}
