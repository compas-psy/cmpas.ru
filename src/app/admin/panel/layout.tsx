import './panel.css';
import { Rail, MobileBar } from '@/components/panel/rail';
import { ThemeScript } from '@/components/panel/theme-toggle';

/**
 * Оболочка управленческой панели.
 *
 * Своей авторизации здесь нет: роль уже проверена в `src/app/admin/layout.tsx`,
 * оттуда же наследуется `robots: noindex` (ТЗ §1, §2). API-маршруты панели
 * проверяют роль самостоятельно — через тот же `auth()`, см. `lib/panel/auth.ts`.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
    return (
        <div data-panel data-theme="light">
            <ThemeScript />
            <Rail />
            <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <MobileBar />
                {children}
            </main>
        </div>
    );
}
