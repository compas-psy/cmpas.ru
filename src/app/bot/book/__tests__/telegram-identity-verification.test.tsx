// @vitest-environment jsdom
//
// Task 3 (PRAKTIKA MVP addendum §6): window.Telegram.WebApp.initDataUnsafe.user
// is client-controlled — anyone can set it before this page's own script
// reads it (in devtools, or by replicating the WebApp environment outside
// Telegram entirely). Before this fix, BookingPageClient looked up an
// existing client's name/phone/upcoming sessions, and recorded 152-ФЗ
// consent, using that unverified id directly. These tests prove the page now
// resolves identity ONLY through resolveVerifiedTelegramUserId(initData) —
// the HMAC-verified id — never through initDataUnsafe.user.id.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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
const SPOOFED_ID = 999999; // attacker-set initDataUnsafe.user.id — must never be used
const VERIFIED_ID = '555'; // what resolveVerifiedTelegramUserId returns after HMAC check

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (window as any).Telegram = {
        WebApp: {
            ready: vi.fn(),
            expand: vi.fn(),
            initData: 'raw-signed-init-data-string',
            initDataUnsafe: { user: { id: SPOOFED_ID, first_name: 'Атакующий' } },
        },
    };

    actions.getPsychologist.mockResolvedValue({
        id: PSY_ID,
        name: 'Анна Волкова',
        scheduleMode: 'booking',
        timeSuggestEnabled: false,
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-15']);
    actions.getAvailableTimes.mockResolvedValue([{ time: '19:00', format: 'online', addressId: null }]);
    actions.resolveClientLinkParam.mockResolvedValue(null);
    actions.checkConsentRequired.mockResolvedValue({ required: false, text: '', version: '' });
    actions.getAddressById.mockResolvedValue(null);
    actions.getClientByTelegram.mockResolvedValue(null);
    actions.getClientUpcomingSessions.mockResolvedValue([]);
});

describe('BookingPageClient резолвит Telegram-личность только через verified initData', () => {
    it('верный initData — getClientByTelegram/getClientUpcomingSessions/checkConsentRequired вызываются с ВЕРИФИЦИРОВАННЫМ id, а не со спуфнутым initDataUnsafe.user.id', async () => {
        actions.resolveVerifiedTelegramUserId.mockResolvedValue(VERIFIED_ID);
        // getClientUpcomingSessions только вызывается для уже известного
        // клиента (см. `if (client) { ... }` в BookingPageClient) — без этого
        // мок getClientByTelegram(null) ветка вообще не дошла бы до неё.
        actions.getClientByTelegram.mockResolvedValue({ id: 'client-1', name: 'Мария', phone: '+79990000000' });

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.resolveVerifiedTelegramUserId).toHaveBeenCalledWith('raw-signed-init-data-string'));
        await waitFor(() => expect(actions.getClientByTelegram).toHaveBeenCalled());

        expect(actions.getClientByTelegram).toHaveBeenCalledWith(PSY_ID, VERIFIED_ID, undefined);
        expect(actions.getClientByTelegram).not.toHaveBeenCalledWith(PSY_ID, String(SPOOFED_ID), undefined);

        await waitFor(() => expect(actions.getClientUpcomingSessions).toHaveBeenCalledWith(PSY_ID, VERIFIED_ID));
        await waitFor(() => expect(actions.checkConsentRequired).toHaveBeenCalledWith(VERIFIED_ID, PSY_ID));
    });

    it('initData не проходит HMAC-проверку (подделан/просрочен) — клиентские данные вообще не запрашиваются', async () => {
        actions.resolveVerifiedTelegramUserId.mockResolvedValue(null);

        render(<BookingPageClient psychologistId={PSY_ID} />);

        await waitFor(() => expect(actions.resolveVerifiedTelegramUserId).toHaveBeenCalledWith('raw-signed-init-data-string'));
        await waitFor(() => expect(screen.getByTestId('pick-date')).toBeInTheDocument());

        expect(actions.getClientByTelegram).not.toHaveBeenCalled();
        expect(actions.getClientUpcomingSessions).not.toHaveBeenCalled();
    });
});
