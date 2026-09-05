// @vitest-environment jsdom
//
// Задача 16 (Web Dashboard: hierarchy/share/onboarding/attention). Это POLISH
// уже работающего дашборда, поэтому тесты одновременно проверяют новое
// (быстрые действия, контекстный онбординг, адресные пункты «требует
// внимания») и то, что старое никуда не делось: герой следующей сессии,
// расписание, активность, статистика недели, дата и неделя, размер заголовка.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

// Дашборд грузит записи через серверное действие getSessions. Подменяем не
// само действие, а то, на чём оно стоит (auth + Prisma): страница дважды
// импортирует один и тот же модуль действий в одном тике, а vitest на
// параллельном динамическом импорте отдаёт мок только одному из вызовов —
// второй получает настоящий модуль. Один источник данных вместо двух снимает
// эту недетерминированность и заодно прогоняет настоящий путь чтения.
type SessionRow = Record<string, unknown>;
const store = vi.hoisted(() => ({ sessions: [] as Record<string, unknown>[] }));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1', name: 'Илья Мартынов' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: vi.fn(async () => store.sessions),
            count: vi.fn(async () => 0),
        },
        homework: { findMany: vi.fn(async () => []) },
    },
}));

const clientActions = vi.hoisted(() => ({ getClients: vi.fn() }));
vi.mock('@/app/diary/actions/clients', () => clientActions);

const settingsActions = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock('@/app/diary/actions/settings', () => settingsActions);

const bookingLinkActions = vi.hoisted(() => ({ getMyBookingUrl: vi.fn() }));
vi.mock('@/app/diary/actions/booking-link', () => bookingLinkActions);

// Задача 17: «требует внимания» приходит из общего Action Center, а не
// считается на дашборде. Здесь проверяется представление — что пункт
// показан и ведёт к своему объекту; сам бэкенд проверяется в
// tests/practice-attention.test.ts.
const attentionActions = vi.hoisted(() => ({ getDashboardAttention: vi.fn() }));
vi.mock('@/app/diary/actions/attention', () => attentionActions);

/** Задача 24: «скрыть» и «поделились» — серверные действия, не браузерные. */
const onboardingActions = {
    dismissOnboarding: vi.fn(async () => null),
    confirmBookingLinkShared: vi.fn(async () => null),
    readOnboardingState: vi.fn(async () => null),
};
vi.mock('@/app/diary/actions/onboarding', () => onboardingActions);

// Модалки заменяем маркерами: нас интересует, ЧТО дашборд в них передаёт
// (какую конкретно запись открыл клик), а не их внутренняя вёрстка.
vi.mock('@/app/diary/components/SessionModal', () => ({
    SessionModal: ({ isOpen, editSession }: { isOpen: boolean; editSession?: { id: string } | null }) =>
        isOpen ? <div data-testid="session-modal">{editSession?.id ?? 'new'}</div> : null,
}));
vi.mock('@/app/diary/components/RescheduleModal', () => ({
    RescheduleModal: () => <div data-testid="reschedule-modal" />,
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import DiaryCalendarPage from '../page';

const TODAY = new Date();
const iso = (d: Date) => d.toISOString();
const daysAhead = (n: number) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };

function session(over: SessionRow = {}): SessionRow {
    return {
        id: 's1', clientId: 'c1', date: iso(daysAhead(1)), time: '19:00', endTime: '20:00',
        duration: 60, type: 'individual', format: 'online', status: 'confirmed',
        notes: null, structuredNotes: null, privateNotes: null, clientSummary: null,
        client: { id: 'c1', name: 'Анна Волкова', consentDate: '2026-01-01' },
        ...over,
    };
}

/**
 * Состояние онбординга приходит с сервера целиком (Задача 24): четыре шага,
 * «скрыто» и производное «пройдено». Веб его не считает — считает общее ядро
 * src/lib/practice/onboarding.ts, одно на веб и приложение.
 */
let onboardingProgress: Record<string, unknown>;

function onboardingState(over: Partial<Record<'client' | 'schedule' | 'session' | 'share', boolean>> = {}, extra: Record<string, unknown> = {}) {
    const steps = { client: false, schedule: false, session: false, share: false, ...over };
    return {
        dismissed: false,
        completed: Object.values(steps).every(Boolean),
        empty: !steps.client && !steps.schedule && !steps.session,
        steps,
        ...extra,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    onboardingProgress = onboardingState();

    store.sessions = [session()];
    attentionActions.getDashboardAttention.mockResolvedValue([]);
    clientActions.getClients.mockResolvedValue([{ id: 'c1', name: 'Анна Волкова', consentDate: '2026-01-01' }]);
    settingsActions.getSettings.mockResolvedValue({ success: true, data: { onlineSessionLink: null } });
    bookingLinkActions.getMyBookingUrl.mockResolvedValue('https://cmpas.ru/u/anna-volkova');

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('/api/onboarding/progress')) {
            return { ok: true, json: async () => onboardingProgress } as unknown as Response;
        }
        return { ok: true, json: async () => ({ user: { id: 'psy-1', name: 'Илья Мартынов' } }) } as unknown as Response;
    }));
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

/** Дашборд рисуется после загрузки сессий — ждём ухода спиннера. */
async function renderDashboard() {
    render(<DiaryCalendarPage />);
    // Первый прогон прогревает цепочку модулей серверных действий — запас по времени.
    await screen.findByText('Расписание на сегодня', {}, { timeout: 5000 });
}

describe('§2 Быстрые действия', () => {
    it('ряд из четырёх действий присутствует на дашборде', async () => {
        await renderDashboard();

        expect(screen.getByRole('button', { name: 'Запись' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Клиент' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Поделиться' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Расписание' })).toBeInTheDocument();
    });

    it('«Расписание» ведёт на существующий экран доступности, а не в новый экран', async () => {
        await renderDashboard();
        expect(screen.getByRole('link', { name: 'Расписание' })).toHaveAttribute('href', '/diary/availability');
    });

    it('«+ Запись» открывает существующую форму создания записи', async () => {
        await renderDashboard();
        expect(screen.queryByTestId('session-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Запись' }));

        expect(await screen.findByTestId('session-modal')).toHaveTextContent('new');
    });
});

describe('§3 Поделиться', () => {
    it('открывает существующий полный ShareSheet прямо с дашборда, без навигации', async () => {
        await renderDashboard();

        fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));

        // Тот самый общий sheet: канал-кнопки, копирование и QR по запросу.
        await screen.findByText('Ссылка для записи');
        expect(bookingLinkActions.getMyBookingUrl).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Max/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Telegram/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /WhatsApp/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Скопировать/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Показать QR/ })).toBeInTheDocument();
    });

    it('нет постоянной гигантской QR-карточки: QR появляется только внутри sheet по запросу', async () => {
        await renderDashboard();

        expect(screen.queryByAltText(/QR/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Показать QR/ })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
        await screen.findByText('Ссылка для записи');

        // Даже открытый sheet не показывает QR, пока его не попросили.
        expect(screen.queryByAltText(/QR/i)).not.toBeInTheDocument();
    });
});

describe('§1 Иерархия и §7 Preserve', () => {
    it('герой следующей сессии на месте, с клиентом и временем', async () => {
        await renderDashboard();

        expect(screen.getByText('Следующая сессия')).toBeInTheDocument();
        expect(screen.getAllByText('Анна Волкова').length).toBeGreaterThan(0);
        expect(screen.getByText('19:00 – 20:00')).toBeInTheDocument();
    });

    it('приветствие остаётся 36px на desktop, дата и неделя сохранены', async () => {
        await renderDashboard();

        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading.className).toContain('md:text-[36px]');
        // Задача 27: имя берётся из User.name, а его отдаёт провайдер входа.
        // Яндекс присылает display_name ?? real_name — обычный человеческий
        // порядок «Имя Фамилия», поэтому имя здесь первое слово. Раньше тест
        // (и код) исходили из обратного порядка, и специалиста встречали
        // фамилией. Разбор источников — в tests/dashboard-greeting.test.ts.
        expect(heading.textContent).toContain('Илья');

        // Дата сегодняшнего дня прописью и полоска недели с числами.
        const dateLine = TODAY.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        expect(screen.getByText(dateLine)).toBeInTheDocument();
        expect(screen.getAllByText(String(TODAY.getDate())).length).toBeGreaterThan(0);
    });

    it('онбординг — контекстный блок ПОСЛЕ героя, а не первый экран', async () => {
        await renderDashboard();
        await screen.findByText('Добро пожаловать в ПРАКТИКУ');

        const hero = screen.getByText('Следующая сессия');
        const onboarding = screen.getByText('Добро пожаловать в ПРАКТИКУ');
        // DOCUMENT_POSITION_FOLLOWING: онбординг идёт по документу ПОСЛЕ героя.
        expect(hero.compareDocumentPosition(onboarding) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('существующие виджеты дашборда не потеряны', async () => {
        await renderDashboard();

        expect(screen.getByText('Расписание на сегодня')).toBeInTheDocument();
        expect(screen.getByText('Требует внимания')).toBeInTheDocument();
        expect(screen.getByText('Активность клиентов')).toBeInTheDocument();
        expect(screen.getByText('Статистика недели')).toBeInTheDocument();
        expect(screen.getByText('Загрузка')).toBeInTheDocument();
    });
});

describe('§4 Онбординг по серверному состоянию (Задача 24)', () => {
    /**
     * Слова «Клиенты», «Запись» и «Поделиться» встречаются и в других местах
     * дашборда — это нормально. Проверяем именно полосу настройки.
     */
    async function strip() {
        const heading = await screen.findByText('Добро пожаловать в ПРАКТИКУ');
        return heading.closest('div.relative') as HTMLElement;
    }

    function stepCard(scope: HTMLElement, label: string) {
        return within(scope).getByText(label).closest('a')!;
    }

    it('четыре продуктовых шага, и «Telegram-бот» среди них больше нет', async () => {
        onboardingProgress = onboardingState({ client: true, schedule: true });
        await renderDashboard();
        const scope = await strip();

        expect(within(scope).getAllByText(/^(Клиенты|Расписание|Запись|Поделиться)$/)).toHaveLength(4);
        expect(stepCard(scope, 'Клиенты').className).toContain('bg-primary/5');
        expect(stepCard(scope, 'Расписание').className).toContain('bg-primary/5');
        expect(stepCard(scope, 'Запись').className).not.toContain('bg-primary/5');
        expect(stepCard(scope, 'Поделиться').className).not.toContain('bg-primary/5');

        // Бот — не один из четырёх шагов MVP; интеграции живут своим разделом.
        expect(screen.queryByText('Telegram-бот')).not.toBeInTheDocument();
    });

    it('импортировавший практику получает закрытые «Клиенты» и «Запись», остальное — по факту', async () => {
        onboardingProgress = onboardingState({ client: true, session: true });
        await renderDashboard();
        const scope = await strip();

        expect(stepCard(scope, 'Клиенты').className).toContain('bg-primary/5');
        expect(stepCard(scope, 'Запись').className).toContain('bg-primary/5');
        expect(stepCard(scope, 'Расписание').className).not.toContain('bg-primary/5');
        expect(screen.getByText('Осталось шагов до готового кабинета: 2.')).toBeInTheDocument();
        // Практика не пустая — выбора «перенести или с нуля» ей не предлагают.
        expect(screen.queryByText('Перенести практику')).not.toBeInTheDocument();
    });

    it('существующая ссылка записи сама шаг «Поделиться» не закрывает', async () => {
        // Ссылка есть у всех с первого дня — и дашборд её уже показывает.
        onboardingProgress = onboardingState({ client: true, schedule: true, session: true });
        await renderDashboard();
        const scope = await strip();

        expect(stepCard(scope, 'Поделиться').className).not.toContain('bg-primary/5');
    });

    it('совсем пустой практике предлагают перенести или начать с нуля', async () => {
        onboardingProgress = onboardingState();
        await renderDashboard();

        const migrate = await screen.findByText('Перенести практику');
        expect(migrate.closest('a')!.getAttribute('href')).toBe('/diary/clients/import-calendar');

        // «С нуля» ничего не отмечает выполненным: чек-лист остаётся на месте.
        fireEvent.click(screen.getByText('Начать с нуля'));
        expect(screen.queryByText('Перенести практику')).not.toBeInTheDocument();
        expect(stepCard(await strip(), 'Клиенты').className).not.toContain('bg-primary/5');
        expect(screen.getByText('Добро пожаловать в ПРАКТИКУ')).toBeInTheDocument();
    });

    it('«Скрыть» уходит на сервер, а не в localStorage', async () => {
        onboardingProgress = onboardingState();
        await renderDashboard();

        fireEvent.click(screen.getByTitle('Скрыть'));

        expect(screen.queryByText('Добро пожаловать в ПРАКТИКУ')).not.toBeInTheDocument();
        await waitFor(() => expect(onboardingActions.dismissOnboarding).toHaveBeenCalled());
        // Браузерная отметка ушла совсем: другой браузер и телефон обязаны
        // узнать о решении человека, а localStorage им ничего не расскажет.
        expect(localStorage.getItem('compas_welcome_dismissed_v1')).toBeNull();
    });

    it('скрытое на сервере состояние не показывает подсказку вовсе', async () => {
        onboardingProgress = onboardingState({}, { dismissed: true });
        await renderDashboard();

        expect(screen.queryByText('Добро пожаловать в ПРАКТИКУ')).not.toBeInTheDocument();
    });
});

describe('§5 Требует внимания — адресные пункты', () => {
    it('клиент без согласия — пункт со ссылкой на КОНКРЕТНОГО клиента', async () => {
        attentionActions.getDashboardAttention.mockResolvedValue([
            { id: 'client_without_consent:c-7', type: 'client_without_consent', label: 'Пётр Ильин · нет согласия на обработку данных', title: 'Пётр Ильин', detail: 'нет согласия на обработку данных', clientId: 'c-7' },
        ]);
        await renderDashboard();

        const item = await screen.findByRole('link', { name: /Пётр Ильин/ });
        expect(item).toHaveAttribute('href', '/diary/clients?clientId=c-7');
        expect(within(item).getByText('нет согласия на обработку данных')).toBeInTheDocument();
    });

    it('сессия без заметки ведёт к заметке ИМЕННО этой сессии', async () => {
        attentionActions.getDashboardAttention.mockResolvedValue([
            { id: 'session_without_notes:s-no-note', type: 'session_without_notes', label: 'Анна · нет заметки по сессии 2 сентября', title: 'Анна', detail: 'нет заметки по сессии 2 сентября', sessionId: 's-no-note', clientId: 'c1' },
        ]);
        await renderDashboard();

        const item = await screen.findByRole('link', { name: /нет заметки по сессии/ });
        expect(item).toHaveAttribute('href', '/diary/session/s-no-note/notes');
    });

    it('неотмеченная оплата ведёт к ИМЕННО этой записи', async () => {
        attentionActions.getDashboardAttention.mockResolvedValue([
            { id: 'session_unpaid:s-pending', type: 'session_unpaid', label: 'Борис · не отмечена оплата 3 сентября', title: 'Борис', detail: 'не отмечена оплата 3 сентября', sessionId: 's-pending', clientId: 'c2' },
        ]);
        await renderDashboard();

        const item = await screen.findByRole('link', { name: /не отмечена оплата/ });
        expect(item).toHaveAttribute('href', '/diary/session/s-pending');
    });

    it('незакрытый импорт ведёт на экран разбора того же источника', async () => {
        attentionActions.getDashboardAttention.mockResolvedValue([
            { id: 'import_review:b-1', type: 'import_review', label: 'Импорт календаря · требуется проверка: 3', title: 'Импорт календаря', detail: 'требуется проверка: 3', batchId: 'b-1', importSource: 'calendar' },
        ]);
        await renderDashboard();

        const item = await screen.findByRole('link', { name: /Импорт календаря/ });
        expect(item).toHaveAttribute('href', '/diary/clients/import-calendar');
    });

    it('каждый показанный пункт ведёт к конкретному объекту — счётчика без перехода нет', async () => {
        attentionActions.getDashboardAttention.mockResolvedValue([
            { id: 'client_without_consent:c-7', type: 'client_without_consent', label: 'Пётр · нет согласия', title: 'Пётр', detail: 'нет согласия', clientId: 'c-7' },
            { id: 'session_unpaid:s-2', type: 'session_unpaid', label: 'Борис · не отмечена оплата', title: 'Борис', detail: 'не отмечена оплата', sessionId: 's-2', clientId: 'c-2' },
            { id: 'session_without_notes:s-3', type: 'session_without_notes', label: 'Анна · нет заметки', title: 'Анна', detail: 'нет заметки', sessionId: 's-3', clientId: 'c-3' },
        ]);
        await renderDashboard();

        const items = await screen.findAllByTestId('attention-item');
        expect(items.length).toBe(3);
        for (const item of items) {
            expect(item.tagName).toBe('A');
            const href = item.getAttribute('href') || '';
            // Ссылка адресует объект, а не общий список.
            expect(href).toMatch(/\/diary\/(session\/[^/]+|clients\?clientId=)/);
        }
    });

    it('когда всё закрыто — блок говорит об этом, а не показывает пустой счётчик', async () => {
        await renderDashboard();
        expect(screen.getByText('Всё в порядке ✓')).toBeInTheDocument();
        expect(screen.queryAllByTestId('attention-item')).toHaveLength(0);
    });
});
