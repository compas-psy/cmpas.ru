// @vitest-environment jsdom
//
// Задача 18 — расписание и кабинеты.
//
// Приёмочный случай, вокруг которого всё крутится:
//   Понедельник  09:00–13:00 · Онлайн
//                15:00–21:00 · Очно · Яузская
// Это ДВА независимых окна одного дня. Раньше карточка правила показывала
// «Понедельник – Пятница, 09:00 – 21:00»: минимум начала и максимум конца по
// всем окнам, то есть ровно то схлопывание, которого быть не должно.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('@/components/ui/address-autocomplete', () => ({
    __esModule: true,
    default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
        <input aria-label={placeholder || 'Адрес'} value={value} onChange={e => onChange(e.target.value)} />
    ),
}));

// Страница расписания тянет за собой действия и пикеры — для проверки
// ссылки «глазами клиента» достаточно источника адреса записи.
vi.mock('@/app/diary/actions/booking-link', () => ({
    getMyBookingUrl: vi.fn(async () => 'https://cmpas.ru/u/anna-volkova'),
}));
vi.mock('@/app/diary/actions/availability', () => ({
    getAvailabilitySlots: vi.fn(async () => ({ success: true, data: [] })),
    createAvailabilitySlot: vi.fn(), updateAvailabilitySlot: vi.fn(), deleteAvailabilitySlot: vi.fn(),
    getTimeBlocks: vi.fn(async () => ({ success: true, data: [] })), createTimeBlock: vi.fn(),
    deleteTimeBlock: vi.fn(), checkBlockIntersections: vi.fn(), createManualSlot: vi.fn(),
}));
vi.mock('@/app/diary/actions/settings', () => ({
    getAddresses: vi.fn(async () => ({ success: true, data: [] })),
    getSettings: vi.fn(async () => ({ success: true, data: {} })), updateSettings: vi.fn(),
}));
vi.mock('@/app/diary/actions/schedule-rules', () => ({
    getScheduleRules: vi.fn(async () => ({ success: true, data: [] })),
    createScheduleRule: vi.fn(), updateScheduleRule: vi.fn(), deleteScheduleRule: vi.fn(),
    cloneScheduleRule: vi.fn(), migrateOrphanSlots: vi.fn(async () => ({ success: true, migrated: 0 })),
}));
vi.mock('@/app/bot/actions', () => ({ getAvailableDates: vi.fn(async () => []), getAvailableTimes: vi.fn(async () => []) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { RuleWeekSchedule, groupWindowsByWeekday, windowLabel } from '../RuleWeekSchedule';
import { CabinetCard } from '../../settings/CabinetCard';

const CABINETS = [
    { id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5' },
    { id: 'a-kurkino', name: 'Куркино', address: 'ул. Соловьиная роща, 1' },
];

// Понедельник = 0 в этой модели дней недели.
const MONDAY_ONLINE = { id: 'w-mon-online', dayOfWeek: 0, startTime: '09:00', endTime: '13:00', format: 'online', addressId: null };
const MONDAY_OFFLINE = { id: 'w-mon-offline', dayOfWeek: 0, startTime: '15:00', endTime: '21:00', format: 'offline', addressId: 'a-yauzskaya' };
const TUESDAY_OFFLINE = { id: 'w-tue', dayOfWeek: 1, startTime: '10:00', endTime: '18:00', format: 'offline', addressId: 'a-kurkino' };

afterEach(cleanup);

describe('§1 несколько независимых правил в один день', () => {
    it('понедельник показывает оба окна одновременно, а не одно слитое', () => {
        render(<RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE]} cabinets={CABINETS} />);

        const monday = screen.getByTestId('weekday-0');
        const windows = within(monday).getAllByTestId('schedule-window');

        expect(windows).toHaveLength(2);
        expect(windows[0]).toHaveTextContent('09:00–13:00 · Онлайн');
        expect(windows[1]).toHaveTextContent('15:00–21:00 · Очно · Яузская');
        // Никакого «09:00–21:00» на экране быть не может.
        expect(screen.queryByText(/09:00–21:00/)).not.toBeInTheDocument();
    });

    it('окна одного дня не дедуплицируются и не сортируются в диапазон', () => {
        const [monday] = groupWindowsByWeekday([MONDAY_OFFLINE, MONDAY_ONLINE]);

        expect(monday.dayOfWeek).toBe(0);
        expect(monday.windows.map(w => w.id)).toEqual(['w-mon-online', 'w-mon-offline']);
    });

    it('каждый день недели остаётся своим — вторник не примешивается к понедельнику', () => {
        render(<RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE, TUESDAY_OFFLINE]} cabinets={CABINETS} />);

        expect(within(screen.getByTestId('weekday-0')).getAllByTestId('schedule-window')).toHaveLength(2);
        const tuesday = within(screen.getByTestId('weekday-1')).getAllByTestId('schedule-window');
        expect(tuesday).toHaveLength(1);
        expect(tuesday[0]).toHaveTextContent('10:00–18:00 · Очно · Куркино');
    });

    it('после перезагрузки (нового рендера тех же данных) остаются оба окна понедельника и окно вторника', () => {
        const { unmount } = render(<RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE, TUESDAY_OFFLINE]} cabinets={CABINETS} />);
        expect(screen.getAllByTestId('schedule-window')).toHaveLength(3);
        unmount();

        render(<RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE, TUESDAY_OFFLINE]} cabinets={CABINETS} />);
        expect(screen.getAllByTestId('schedule-window')).toHaveLength(3);
        expect(screen.getByTestId('weekday-0')).toHaveTextContent('09:00–13:00 · Онлайн');
        expect(screen.getByTestId('weekday-0')).toHaveTextContent('15:00–21:00 · Очно · Яузская');
        expect(screen.getByTestId('weekday-1')).toHaveTextContent('10:00–18:00 · Очно · Куркино');
    });
});

describe('§1 правка одного окна не задевает соседнее', () => {
    it('редактирование открывает ИМЕННО то окно, по которому нажали', () => {
        const onEditWindow = vi.fn();
        render(<RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE]} cabinets={CABINETS} onEditWindow={onEditWindow} />);

        fireEvent.click(screen.getByText('15:00–21:00 · Очно · Яузская'));

        expect(onEditWindow).toHaveBeenCalledTimes(1);
        expect(onEditWindow.mock.calls[0][0].id).toBe('w-mon-offline');
    });

    it('удаление адресует одно окно, второе окно дня остаётся на экране', () => {
        const onDeleteWindow = vi.fn();
        const { rerender } = render(
            <RuleWeekSchedule windows={[MONDAY_ONLINE, MONDAY_OFFLINE]} cabinets={CABINETS} onDeleteWindow={onDeleteWindow} />,
        );

        fireEvent.click(screen.getByLabelText('Удалить окно 09:00–13:00'));
        expect(onDeleteWindow).toHaveBeenCalledWith('w-mon-online');

        // Сервер убрал только это окно — соседнее осталось нетронутым.
        rerender(<RuleWeekSchedule windows={[MONDAY_OFFLINE]} cabinets={CABINETS} onDeleteWindow={onDeleteWindow} />);
        const windows = screen.getAllByTestId('schedule-window');
        expect(windows).toHaveLength(1);
        expect(windows[0]).toHaveTextContent('15:00–21:00 · Очно · Яузская');
    });
});

describe('§2 формат и кабинет берутся у самого окна', () => {
    it('онлайн-окно не получает кабинет соседнего очного окна того же дня', () => {
        expect(windowLabel(MONDAY_ONLINE, CABINETS)).toBe('09:00–13:00 · Онлайн');
        expect(windowLabel(MONDAY_OFFLINE, CABINETS)).toBe('15:00–21:00 · Очно · Яузская');
    });

    it('смешанный формат называет и кабинет', () => {
        const both = { ...MONDAY_OFFLINE, format: 'both' };
        expect(windowLabel(both, CABINETS)).toBe('15:00–21:00 · Онлайн и очно · Яузская');
    });

    it('кабинет, которого больше нет в списке, не выдумывается', () => {
        const orphan = { ...MONDAY_OFFLINE, addressId: 'a-deleted' };
        expect(windowLabel(orphan, CABINETS)).toBe('15:00–21:00 · Очно');
    });
});

describe('§4 карточка кабинета', () => {
    const noop = () => {};

    it('показывает название, адрес и метку основного', () => {
        render(<CabinetCard
            cabinet={{ id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5', isPrimary: true, isActive: true }}
            onSetPrimary={noop} onSave={noop} onDeactivate={noop} onActivate={noop}
        />);

        const card = screen.getByTestId('cabinet-card');
        expect(within(card).getByText('Яузская')).toBeInTheDocument();
        expect(within(card).getByText(/ул. Яузская, 5/)).toBeInTheDocument();
        expect(within(card).getByText('Основной')).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: /Редактировать/ })).toBeInTheDocument();
    });

    it('не основной кабинет так и подписан, и его можно сделать основным', () => {
        const onSetPrimary = vi.fn();
        render(<CabinetCard
            cabinet={{ id: 'a-kurkino', name: 'Куркино', address: 'ул. Соловьиная роща, 1', isPrimary: false, isActive: true }}
            onSetPrimary={onSetPrimary} onSave={noop} onDeactivate={noop} onActivate={noop}
        />);

        expect(screen.getByText('Не основной')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Сделать основным' }));
        expect(onSetPrimary).toHaveBeenCalledWith('a-kurkino');
    });

    it('редактирование сохраняет новые название и адрес именно этого кабинета', async () => {
        const onSave = vi.fn();
        render(<CabinetCard
            cabinet={{ id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5', isActive: true }}
            onSetPrimary={noop} onSave={onSave} onDeactivate={noop} onActivate={noop}
        />);

        fireEvent.click(screen.getByRole('button', { name: /Редактировать/ }));
        fireEvent.change(screen.getByLabelText('Название кабинета'), { target: { value: 'Яузская, каб. 12' } });
        fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));

        expect(onSave).toHaveBeenCalledWith('a-yauzskaya', { name: 'Яузская, каб. 12', address: 'ул. Яузская, 5' });
    });

    it('«убрать» — это вывод из работы, а выведенный кабинет можно вернуть', () => {
        const onDeactivate = vi.fn();
        const onActivate = vi.fn();
        const { rerender } = render(<CabinetCard
            cabinet={{ id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5', isActive: true }}
            onSetPrimary={noop} onSave={noop} onDeactivate={onDeactivate} onActivate={onActivate}
        />);

        fireEvent.click(screen.getByRole('button', { name: 'Убрать' }));
        expect(onDeactivate).toHaveBeenCalledWith('a-yauzskaya');

        rerender(<CabinetCard
            cabinet={{ id: 'a-yauzskaya', name: 'Яузская', address: 'ул. Яузская, 5', isActive: false }}
            onSetPrimary={noop} onSave={noop} onDeactivate={onDeactivate} onActivate={onActivate}
        />);

        expect(screen.getByText('Выведен из работы')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Вернуть в работу' }));
        expect(onActivate).toHaveBeenCalledWith('a-yauzskaya');
    });
});

describe('§3 «Посмотреть глазами клиента»', () => {
    it('ведёт на постоянную страницу записи /u/<slug> и открывает её в новой вкладке', async () => {
        const { BookingLinkCard } = await import('../BookingLinkCard');
        render(<BookingLinkCard psychologistId="psy-1" isPrivate={false} />);

        const link = await screen.findByRole('link', { name: /Посмотреть глазами клиента/ });
        expect(link).toHaveAttribute('href', 'https://cmpas.ru/u/anna-volkova');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('это не временная ссылка-приглашение и не /connect/<token>', async () => {
        const { BookingLinkCard } = await import('../BookingLinkCard');
        render(<BookingLinkCard psychologistId="psy-1" isPrivate={false} />);

        const link = await screen.findByRole('link', { name: /Посмотреть глазами клиента/ });
        const href = link.getAttribute('href')!;
        expect(href).not.toContain('/connect/');
        expect(href).not.toContain('token=');
        expect(href).not.toContain('/bot/book/');
    });

    it('в приватном режиме ссылки нет — записи всё равно нет', async () => {
        const { BookingLinkCard } = await import('../BookingLinkCard');
        render(<BookingLinkCard psychologistId="psy-1" isPrivate />);

        expect(screen.queryByRole('link', { name: /Посмотреть глазами клиента/ })).not.toBeInTheDocument();
    });
});
