// @vitest-environment jsdom
//
// Task 3 (PRAKTIKA MVP addendum §6, item B — founder review of 229d99e):
// BookingPageClient used to read localStorage.compas_clientId (a RAW
// DiaryClient id, settable by anyone via devtools) and pass it straight into
// getClientById/getClientUpcomingSessionsById — disclosing that client's
// name, phone, and upcoming sessions to whoever opened the booking page with
// that key set. The fix: localStorage may only ever hold a previously issued
// SIGNED link token (compas_clientToken), verified server-side on every use,
// exactly like the `?c=` URL param — never a raw id treated as identity.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

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
    getClientById: vi.fn(),
    getClientUpcomingSessionsById: vi.fn(),
}));

vi.mock('@/app/bot/actions', () => actions);

import BookingPageClient from '../BookingPageClient';

const PSY_ID = 'psy-1';

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as any).Telegram;

    actions.getPsychologist.mockResolvedValue({
        id: PSY_ID,
        name: 'Анна Волкова',
        scheduleMode: 'booking',
        timeSuggestEnabled: false,
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-15']);
    actions.getAvailableTimes.mockResolvedValue([{ time: '19:00', format: 'online', addressId: null }]);
    actions.checkConsentRequired.mockResolvedValue({ required: false, text: '', version: '' });
    actions.getAddressById.mockResolvedValue(null);
});

describe('BookingPageClient — localStorage никогда не является proof of identity', () => {
    it('legacy compas_clientId (сырой id) в localStorage больше не читается вовсе', async () => {
        localStorage.setItem('compas_clientId', 'client-of-victim');
        actions.resolveSignedClientLinkParam.mockResolvedValue(null);

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalled());
        await waitFor(() => expect(actions.getAvailableDates).toHaveBeenCalled());

        expect(actions.resolveSignedClientLinkParam).not.toHaveBeenCalledWith('client-of-victim');
        expect(actions.getClientById).not.toHaveBeenCalled();
        expect(actions.getClientUpcomingSessionsById).not.toHaveBeenCalled();
    });

    it('compas_clientToken в localStorage не проходит строгую проверку — данные клиента не запрашиваются', async () => {
        localStorage.setItem('compas_clientToken', 'st1_tamperedorexpired');
        actions.resolveSignedClientLinkParam.mockResolvedValue(null);

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.resolveSignedClientLinkParam).toHaveBeenCalledWith('st1_tamperedorexpired'));
        await waitFor(() => expect(actions.getAvailableDates).toHaveBeenCalled());

        expect(actions.getClientById).not.toHaveBeenCalled();
        expect(actions.getClientUpcomingSessionsById).not.toHaveBeenCalled();
    });

    it('валидный compas_clientToken в localStorage — резолвится строго, клиентские данные подгружаются как для возвращающегося посетителя', async () => {
        localStorage.setItem('compas_clientToken', 'st1_validtoken');
        actions.resolveSignedClientLinkParam.mockResolvedValue({ clientId: 'client-1' });
        actions.getClientById.mockResolvedValue({ id: 'client-1', name: 'Мария', phone: '+79990000000' });
        actions.getClientUpcomingSessionsById.mockResolvedValue([]);

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.resolveSignedClientLinkParam).toHaveBeenCalledWith('st1_validtoken'));
        await waitFor(() => expect(actions.getClientById).toHaveBeenCalledWith(PSY_ID, 'client-1'));
        await waitFor(() => expect(actions.getClientUpcomingSessionsById).toHaveBeenCalledWith(PSY_ID, 'client-1'));
    });
});
