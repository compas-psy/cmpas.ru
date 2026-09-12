// @vitest-environment jsdom
//
// Порядок на экране записи и немая кнопка.
//
// 12.09.2026, живой клиент: нажал «Утро выходных» — подобранные часы
// появились ВЫШЕ нажатой кнопки, за пределами того, куда он смотрел.
// Решив, что выбор уже сделан, он заполнил имя и телефон и нажал
// «Записаться» — кнопка не сработала и ничего не объяснила.
//
// Оба дефекта об одном: следствие не может стоять выше причины, а
// отключённая кнопка без названной причины неотличима от сломанной.

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
    resolveSignedClientLinkParam: vi.fn(),
    resolveVerifiedTelegramUserId: vi.fn(),
}));

vi.mock('@/app/bot/actions', () => actions);

import BookingPageClient from '../BookingPageClient';

const PSY_ID = 'psy-1';

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>).Telegram;

    actions.getPsychologist.mockResolvedValue({
        id: PSY_ID,
        name: 'Мартынов Илья',
        scheduleMode: 'booking',
        timeSuggestEnabled: true,
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-19']);
    actions.getAvailableTimes.mockResolvedValue([{ time: '10:00', format: 'online', addressId: null }]);
    actions.resolveSignedClientLinkParam.mockResolvedValue(null);
    actions.checkConsentRequired.mockResolvedValue({ required: false, text: '', version: '' });
    actions.getAddressById.mockResolvedValue(null);
    actions.getSuggestedTimes.mockResolvedValue([
        { date: '2026-09-19', time: '10:00', format: 'online', addressId: null },
    ]);
});

describe('порядок: сначала предпочтение, потом подобранные часы', () => {
    it('чип предпочтения стоит на экране ВЫШЕ подобранных часов', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);

        await screen.findByText('Когда вам удобнее?');
        fireEvent.click(screen.getByText('Утро выходных'));

        const slot = await screen.findByText(/19 сентября/);
        const chip = screen.getByText('Утро выходных');

        // compareDocumentPosition: FOLLOWING (4) — значит слот идёт ПОСЛЕ чипа
        // в порядке документа, то есть ниже него на экране.
        expect(chip.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('кнопка записи называет, чего ждёт', () => {
    it('час не выбран — кнопка говорит «Сначала выберите время», а не молчит', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);

        await screen.findByText('Когда вам удобнее?');

        const button = await screen.findByRole('button', { name: /Сначала выберите время/i });
        expect(button).toBeDisabled();
        expect(screen.queryByRole('button', { name: /^Записаться$/ })).not.toBeInTheDocument();
    });

    it('час выбран — кнопка становится «Записаться» и работает', async () => {
        render(<BookingPageClient psychologistId={PSY_ID} />);

        await screen.findByText('Когда вам удобнее?');
        fireEvent.click(screen.getByText('Утро выходных'));

        const slot = await screen.findByText(/19 сентября/);
        fireEvent.click(slot);

        await waitFor(() => {
            const button = screen.getByRole('button', { name: /^Записаться$/ });
            expect(button).not.toBeDisabled();
        });
    });
});
