// @vitest-environment jsdom
//
// Task 14 — Client booking CJM v2. Covers the founder's numbered points not
// already locked in by the pre-existing test files in this directory:
// immediate suggested slots on first open (no persisted preference), exact
// slotToken identity for same-time/different-format-or-office options, the
// full calendar split into online/address sections, known-client fields
// hidden, waitlist copy never promising auto-notification, and the success
// screen naming a real concrete outcome.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-datepicker', () => ({
    __esModule: true,
    default: (props: { onChange: (d: Date) => void }) => (
        <button type="button" data-testid="pick-date" onClick={() => props.onChange(new Date('2026-09-10T00:00:00'))}>
            10 сентября
        </button>
    ),
    registerLocale: () => {},
}));

vi.mock('react-phone-input-2', () => ({
    __esModule: true,
    default: (props: { value: string; onChange: (v: string) => void }) => (
        <input data-testid="phone-input" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    ),
}));

const actions = vi.hoisted(() => ({
    getPsychologist: vi.fn(),
    getAvailableDates: vi.fn(),
    getAvailableTimes: vi.fn(),
    getSuggestedTimes: vi.fn(),
    submitWaitlistInterest: vi.fn(),
    bookSession: vi.fn(),
    getClientByTelegram: vi.fn(),
    getScheduleMode: vi.fn(),
    getClientUpcomingSessions: vi.fn(),
    getAddressById: vi.fn(),
    checkConsentRequired: vi.fn(),
    saveConsent: vi.fn(),
    resolveSignedClientLinkParam: vi.fn(),
    resolveVerifiedTelegramUserId: vi.fn(),
    getClientById: vi.fn(),
    getClientUpcomingSessionsById: vi.fn(),
}));
vi.mock('@/app/bot/actions', () => actions);

import BookingPageClient from '../BookingPageClient';

const PSY_ID = 'psy-1';
const STORAGE_KEY = `booking_pref_${PSY_ID}`;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as any).Telegram;

    actions.getPsychologist.mockResolvedValue({
        id: PSY_ID,
        name: 'Анна Волкова',
        scheduleMode: 'booking',
        timeSuggestEnabled: false,
        psychologistSettings: { onlineSessionLink: 'https://meet.example/anna' },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-10']);
    actions.resolveSignedClientLinkParam.mockResolvedValue(null);
    actions.checkConsentRequired.mockResolvedValue({ required: true, text: 'Согласие на обработку ПДн', version: 'v1' });
    actions.saveConsent.mockResolvedValue({ success: true });
    actions.getAddressById.mockResolvedValue(null);
    actions.bookSession.mockResolvedValue({ success: true, clientId: 'client-1', clientToken: 'sc1_new' });
});

describe('Task 14 п.1/2 — первый экран сразу показывает ближайшие варианты, без persist', () => {
    beforeEach(() => {
        actions.getPsychologist.mockResolvedValue({
            id: PSY_ID, name: 'Анна Волкова', scheduleMode: 'booking', timeSuggestEnabled: true,
            psychologistSettings: { onlineSessionLink: null },
        });
        actions.getSuggestedTimes.mockResolvedValue([
            { date: '2026-09-10', time: '09:00', format: 'online', addressId: null, availabilitySlotId: 'a1', scheduleRuleId: null, duration: 50, slotToken: 'slt1_morning', addressName: null },
            { date: '2026-09-10', time: '18:00', format: 'offline', addressId: 'addr-1', availabilitySlotId: 'a2', scheduleRuleId: null, duration: 50, slotToken: 'slt1_evening', addressName: 'Яузская' },
        ]);
    });

    it('подобранные варианты видны сразу, без клика по чипу предпочтения', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        await waitFor(() => expect(actions.getSuggestedTimes).toHaveBeenCalledWith(PSY_ID, 'any', null));
        expect(await screen.findByText(/сентября · 18:00/)).toBeInTheDocument();
        expect(screen.getByText(/сентября · 09:00/)).toBeInTheDocument();
    });

    it('автоматическая начальная загрузка НЕ пишет booking_pref в localStorage', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        await waitFor(() => expect(actions.getSuggestedTimes).toHaveBeenCalled());
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('утренний онлайн и вечерний очный различимы по тексту карточки (дата+время, длительность, формат, адрес)', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        await screen.findByText(/сентября · 09:00/);

        const morningCard = screen.getByText(/сентября · 09:00/).closest('button')!;
        const eveningCard = screen.getByText(/сентября · 18:00/).closest('button')!;
        expect(morningCard.textContent).toContain('Онлайн');
        expect(morningCard.textContent).not.toContain('Очно');
        expect(eveningCard.textContent).toContain('Очно');
        expect(eveningCard.textContent).toContain('Яузская');
        expect(eveningCard.textContent).toContain('50 минут');
    });
});

describe('Task 14 п.3/5/9 — full calendar: online/offline/несколько кабинетов разделены секциями с exact slotToken', () => {
    beforeEach(() => {
        actions.getAvailableTimes.mockResolvedValue([
            { time: '18:00', format: 'online', addressId: null, slotToken: 'slt1_online', slotTokenOnline: null, slotTokenOffline: null, addressName: null },
            { time: '18:00', format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_yauzskaya', slotTokenOnline: null, slotTokenOffline: null, addressName: 'Яузская' },
            { time: '18:00', format: 'offline', addressId: 'addr-kurkino', slotToken: 'slt1_kurkino', slotTokenOnline: null, slotTokenOffline: null, addressName: 'Куркино' },
        ]);
    });

    it('три секции — ОНЛАЙН, ЯУЗСКАЯ, КУРКИНО — каждая со своей кнопкой 18:00', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        fireEvent.click(await screen.findByTestId('pick-date'));
        await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());

        expect(screen.getByText('ОНЛАЙН')).toBeInTheDocument();
        expect(screen.getByText('ЯУЗСКАЯ')).toBeInTheDocument();
        expect(screen.getByText('КУРКИНО')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: '18:00' })).toHaveLength(3);
    });

    it('клик по варианту в секции КУРКИНО отправляет именно его slotToken при записи — не online, не Яузскую', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        fireEvent.click(await screen.findByTestId('pick-date'));
        await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());

        const buttons = screen.getAllByRole('button', { name: '18:00' });
        fireEvent.click(buttons[2]); // ОНЛАЙН, ЯУЗСКАЯ, КУРКИНО — third is Куркино

        fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Игорь' } });
        fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+79997654321' } });
        fireEvent.submit(screen.getByRole('button', { name: /Записаться/i }).closest('form')!);

        const checkbox = await screen.findByRole('checkbox');
        fireEvent.click(checkbox);
        fireEvent.click(screen.getByRole('button', { name: /Подтвердить и записаться/i }));

        await waitFor(() => expect(actions.bookSession).toHaveBeenCalled());
        const [, , form] = actions.bookSession.mock.calls[0];
        expect(form.slotToken).toBe('slt1_kurkino');
    });
});

describe('Task 14 п.6 — известный клиент не видит поля имени/телефона', () => {
    it('resolveSignedClientLinkParam резолвит известного клиента — поля имени/телефона скрыты, показан текст с именем', async () => {
        actions.resolveSignedClientLinkParam.mockResolvedValue({ clientId: 'client-1' });
        actions.getClientById.mockResolvedValue({ id: 'client-1', name: 'Анна', phone: null });
        actions.getClientUpcomingSessionsById.mockResolvedValue([]);

        // resolveSignedClientLinkParam path reads `?c=` — simulate via localStorage token instead (same code path).
        localStorage.setItem('compas_clientToken', 'sc1_known');

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(screen.getByTestId('pick-date')).toBeInTheDocument());
        await screen.findByText(/данные уже у нас/i);
        expect(screen.queryByPlaceholderText('Ваше имя')).not.toBeInTheDocument();
        expect(screen.queryByTestId('phone-input')).not.toBeInTheDocument();
    });
});

describe('Task 14 п.7 — waitlist: только capture, без обещаний авто-уведомления', () => {
    beforeEach(() => {
        actions.getPsychologist.mockResolvedValue({
            id: PSY_ID, name: 'Анна Волкова', scheduleMode: 'booking', timeSuggestEnabled: true,
            psychologistSettings: { onlineSessionLink: null },
        });
        actions.getSuggestedTimes.mockResolvedValue([]);
        actions.submitWaitlistInterest.mockResolvedValue({ success: true });
    });

    it('пустое расписание: текст нейтральный, без "предложим первое освободившееся"', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        await waitFor(() => expect(actions.getSuggestedTimes).toHaveBeenCalled());

        const bodyText = document.body.textContent ?? '';
        expect(bodyText).toContain('Нет подходящего времени');
        expect(bodyText).not.toMatch(/предложим первое освободившееся/i);
        expect(bodyText).not.toMatch(/мы свяжемся/i);
    });

    it('после отправки — заявка принята, без обещания связаться автоматически', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);
        await waitFor(() => expect(actions.getSuggestedTimes).toHaveBeenCalled());

        fireEvent.change(screen.getByPlaceholderText('Как к вам обращаться'), { target: { value: 'Мария' } });
        fireEvent.change(screen.getByPlaceholderText('Телефон или Telegram'), { target: { value: '+79990001122' } });
        fireEvent.click(screen.getByText('Записать в лист ожидания'));

        await waitFor(() => expect(actions.submitWaitlistInterest).toHaveBeenCalled());
        const bodyText = document.body.textContent ?? '';
        // Макет C12: нейтральная формулировка. Автоматическое уведомление
        // листа ожидания в этот запуск не входит, поэтому текст говорит
        // только о том, что заявку увидят.
        expect(bodyText).toContain('Заявка отправлена');
        expect(bodyText).not.toMatch(/мы (обязательно )?напишем/i);
        expect(bodyText).not.toMatch(/как только освободится/i);
        expect(bodyText).not.toMatch(/уведомим автоматически/i);
    });
});

describe('Task 14 п.8 — success screen называет конкретный исход', () => {
    it('очно: показывает реальный кабинет/адрес, не техническую addressId', async () => {
        actions.getAvailableTimes.mockResolvedValue([
            { time: '16:00', format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_offline', slotTokenOnline: null, slotTokenOffline: null, addressName: 'Яузская' },
        ]);
        actions.getAddressById.mockResolvedValue({ name: 'Яузская', address: 'ул. Яузская, 5' });

        render(<BookingPageClient psychologistId={PSY_ID} />);
        fireEvent.click(await screen.findByTestId('pick-date'));
        await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());
        fireEvent.click(await screen.findByRole('button', { name: '16:00' }));

        fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Ольга' } });
        fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+79995554433' } });
        fireEvent.submit(screen.getByRole('button', { name: /Записаться/i }).closest('form')!);
        fireEvent.click(await screen.findByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Подтвердить и записаться/i }));

        await waitFor(() => expect(screen.getByText(/Вы записаны/i)).toBeInTheDocument());
        const bodyText = document.body.textContent ?? '';
        expect(bodyText).toContain('Яузская');
        expect(bodyText).toContain('ул. Яузская, 5');
        expect(bodyText).not.toContain('addr-yauzskaya');
    });

    it('онлайн: показывает формат "Онлайн" и ссылку на встречу', async () => {
        actions.getAvailableTimes.mockResolvedValue([
            { time: '10:00', format: 'online', addressId: null, slotToken: 'slt1_online', slotTokenOnline: null, slotTokenOffline: null, addressName: null },
        ]);

        render(<BookingPageClient psychologistId={PSY_ID} />);
        fireEvent.click(await screen.findByTestId('pick-date'));
        await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());
        fireEvent.click(await screen.findByRole('button', { name: '10:00' }));

        fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Пётр' } });
        fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+79991112233' } });
        fireEvent.submit(screen.getByRole('button', { name: /Записаться/i }).closest('form')!);
        fireEvent.click(await screen.findByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Подтвердить и записаться/i }));

        await waitFor(() => expect(screen.getByText(/Вы записаны/i)).toBeInTheDocument());
        const bodyText = document.body.textContent ?? '';
        expect(bodyText).toContain('Онлайн');
        expect(bodyText).toContain('https://meet.example/anna');
    });
});

describe('Task 14 п.18 — путь к управлению записями/переносу остаётся достижимым', () => {
    it('кнопка "Готово" на success screen ведёт на /bot/client (существующий signed client-management путь)', async () => {
        actions.getAvailableTimes.mockResolvedValue([
            { time: '10:00', format: 'online', addressId: null, slotToken: 'slt1_online', slotTokenOnline: null, slotTokenOffline: null, addressName: null },
        ]);
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', { value: { ...originalLocation, href: '' }, writable: true, configurable: true });

        render(<BookingPageClient psychologistId={PSY_ID} />);
        fireEvent.click(await screen.findByTestId('pick-date'));
        await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());
        fireEvent.click(await screen.findByRole('button', { name: '10:00' }));

        fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Света' } });
        fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+79993332211' } });
        fireEvent.submit(screen.getByRole('button', { name: /Записаться/i }).closest('form')!);
        fireEvent.click(await screen.findByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Подтвердить и записаться/i }));

        await waitFor(() => expect(screen.getByText(/Вы записаны/i)).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Готово/i }));
        expect(window.location.href).toBe('/bot/client');

        Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    });
});
