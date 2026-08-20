import './panel.css';
import { Rail, MobileBar } from '@/components/panel/rail';
import { ThemeScript } from '@/components/panel/theme-toggle';
import { screenSeverities } from '@/lib/panel/build';

/**
 * Оболочка управленческой панели.
 *
 * Своей авторизации здесь нет: роль уже проверена в `src/app/admin/layout.tsx`,
 * оттуда же наследуется `robots: noindex` (ТЗ §1, §2). API-маршруты панели
 * проверяют роль самостоятельно — через тот же `auth()`, см. `lib/panel/auth.ts`.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
    // Точка у пункта меню — агрегированное худшее состояние экрана. Считается
    // по кешированным экранам: «увидел красное — ткнул» работает из любого места.
    // Падение сборки состояний не должно ронять оболочку — тогда просто нет точек.
    const severity = await screenSeverities().catch(() => ({}));

    return (
        <div data-panel data-theme="light">
            <ThemeScript />
            <Rail severity={severity} />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <MobileBar />
                {children}
            </main>
        </div>
    );
}
