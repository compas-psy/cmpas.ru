// @vitest-environment jsdom
//
// O-260829 §4.2: экран подтверждения называл канал доставки жёстко —
// "Уведомление придёт в Telegram" без единого условия, даже когда клиент
// пришёл по ссылке из Max (никакого window.Telegram в этом контексте).
// Приёмка по ТЗ: страница без window.Telegram доходит до bookingSuccess,
// и текст экрана НЕ должен содержать слова «Telegram».
//
// Сторонние UI-компоненты (react-datepicker, react-phone-input-2) заменены
// простыми заглушками — тест проверяет логику этого компонента и текст
// экрана, а не разметку сторонних библиотек.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useParams: () => ({ psychologistId: 'psy-1' }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('react-datepicker', () => ({
    __esModule: true,
    default: (props: { selected: Date | null; onChange: (d: Date) => void }) => (
        <button type="button" data-testid="pick-date" onClick={() => props.onChange(new Date('2026-09-15T00:00:00'))}>
            15 сентября
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
    resolveClientLinkParam: vi.fn(),
}));

vi.mock('@/app/bot/actions', () => actions);

import ClientBookingPage from '../page';

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom по умолчанию не даёт window.Telegram — сценарий "открыто из Max".
    delete (window as any).Telegram;

    actions.getPsychologist.mockResolvedValue({
        id: 'psy-1',
        name: 'Анна Волкова',
        scheduleMode: 'booking',
        timeSuggestEnabled: false, // проще прогнать через обычный календарь
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-15']);
    actions.getAvailableTimes.mockResolvedValue([
        { time: '19:00', format: 'online', addressId: null },
    ]);
    actions.resolveClientLinkParam.mockResolvedValue(null);
    // Неизвестный клиент без Telegram и без client id из URL — page.tsx
    // безусловно требует согласие в этой ветке (см. "Unknown client without
    // TG and without client ID"), независимо от checkConsentRequired.required.
    // Оба теста идут через эту обязательную модалку, а не мимо неё.
    actions.checkConsentRequired.mockResolvedValue({ required: true, text: 'Согласие на обработку ПДн', version: 'v1' });
    actions.saveConsent.mockResolvedValue({ success: true });
    actions.bookSession.mockResolvedValue({ success: true, clientId: 'client-1' });
    actions.getAddressById.mockResolvedValue(null);
});

async function fillAndSubmitBookingForm() {
    await waitFor(() => expect(screen.getByTestId('pick-date')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('pick-date'));
    await waitFor(() => expect(actions.getAvailableTimes).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('19:00'));

    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Мария' } });
    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+79991234567' } });
    fireEvent.submit(screen.getByRole('button', { name: /Записаться/i }).closest('form')!);

    // Согласие обязательно для этого сценария (неизвестный клиент) — принимаем модалку.
    const checkbox = await screen.findByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить и записаться/i }));

    await waitFor(() => expect(actions.bookSession).toHaveBeenCalled());
}

describe('экран подтверждения называет настоящий канал доставки (§4.2)', () => {
    it('без window.Telegram — канал Max, текст не содержит "Telegram"', async () => {
        render(<ClientBookingPage />);
        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());

        await fillAndSubmitBookingForm();

        await waitFor(() => expect(screen.getByText(/Вы записаны/i)).toBeInTheDocument());

        const screenText = document.body.textContent ?? '';
        expect(screenText).not.toContain('Telegram');
        expect(screenText).toContain('Уведомление придёт в Max');
    });

    it('с window.Telegram.WebApp — канал Telegram', async () => {
        (window as any).Telegram = { WebApp: { ready: vi.fn(), expand: vi.fn(), initDataUnsafe: {} } };

        render(<ClientBookingPage />);
        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());

        await fillAndSubmitBookingForm();

        await waitFor(() => expect(screen.getByText(/Вы записаны/i)).toBeInTheDocument());

        const screenText = document.body.textContent ?? '';
        expect(screenText).toContain('Уведомление придёт в Telegram');
    });
});
