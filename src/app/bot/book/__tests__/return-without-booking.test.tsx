// @vitest-environment jsdom
//
// O-260829 §5.3 "Возврат по ссылке без брони" (S1-R): раньше отсутствовало
// целиком. Клиент, который выбрал предпочтение по времени, но не завершил
// запись, и вернулся по той же ссылке в течение 30 дней, должен увидеть
// баннер "С возвращением" со свежим (не кэшированным) подбором времени —
// без единой записи на сервере (сам факт визита на страницу записи уже
// чувствителен). Приёмка: свежая запись (<30 дней) показывает баннер;
// старая (>30 дней) или отсутствующая — обычный первый экран; кнопка
// "Не запоминать меня" сразу очищает localStorage.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-datepicker', () => ({
    __esModule: true,
    default: () => <button type="button" data-testid="pick-date">15 сентября</button>,
    registerLocale: () => {},
}));

vi.mock('react-phone-input-2', () => ({
    __esModule: true,
    default: () => <input data-testid="phone-input" />,
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
    resolveClientLinkParam: vi.fn(),
    resolveVerifiedTelegramUserId: vi.fn(),
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
        timeSuggestEnabled: true,
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-15']);
    actions.getAvailableTimes.mockResolvedValue([{ time: '19:00', format: 'online', addressId: null }]);
    actions.resolveClientLinkParam.mockResolvedValue(null);
    actions.checkConsentRequired.mockResolvedValue({ required: false, text: '', version: '' });
    actions.getAddressById.mockResolvedValue(null);
    actions.getSuggestedTimes.mockResolvedValue([
        { date: '2026-09-20', time: '19:00', format: 'online', addressId: null },
    ]);
});

describe('возврат без брони — баннер и свежий подбор (§5.3)', () => {
    it('свежая запись (<30 дней) показывает баннер и сразу подбирает время заново', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ preference: 'weekend_morning', savedAt: Date.now() - 24 * 60 * 60 * 1000 }));

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());
        await screen.findByText(/С возвращением/i);
        expect(screen.getAllByText(/Утро выходных/i).length).toBeGreaterThan(0);
        await waitFor(() => expect(actions.getSuggestedTimes).toHaveBeenCalledWith(PSY_ID, 'weekend_morning', null));
    });

    it('запись старше 30 дней — обычный первый экран, без баннера, запись стёрта', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ preference: 'any', savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 }));

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());
        await screen.findByText('Когда вам удобнее?');
        expect(screen.queryByText(/С возвращением/i)).not.toBeInTheDocument();
        expect(actions.getSuggestedTimes).not.toHaveBeenCalled();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('нет сохранённой записи — обычный первый экран', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());
        await screen.findByText('Когда вам удобнее?');
        expect(screen.queryByText(/С возвращением/i)).not.toBeInTheDocument();
    });

    it('"Не запоминать меня" сразу очищает localStorage и скрывает баннер, без модалки подтверждения', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ preference: 'any', savedAt: Date.now() }));

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await screen.findByText(/С возвращением/i);
        fireEvent.click(screen.getByText(/Не запоминать меня на этом устройстве/i));

        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(screen.queryByText(/С возвращением/i)).not.toBeInTheDocument();
    });

    it('выбор чипа предпочтения вручную сохраняет его в localStorage', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);

        await screen.findByText('Когда вам удобнее?');
        fireEvent.click(screen.getByText('Утро выходных'));

        await waitFor(() => {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            expect(saved?.preference).toBe('weekend_morning');
            expect(typeof saved?.savedAt).toBe('number');
        });
    });
});
