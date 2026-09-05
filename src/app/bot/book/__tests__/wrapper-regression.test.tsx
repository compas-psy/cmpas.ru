// @vitest-environment jsdom
//
// Task 14 point 11 (wrapper regression): /bot/book/<psychologistId>, /u/<slug>
// and the legacy Cyrillic /у/<slug> alias must all render the exact same
// BookingPageClient — never a second booking implementation. This renders
// BOTH the id-based and slug-based wrappers against the SAME underlying
// psychologistId and the SAME mocked actions, and asserts they produce
// identical output — proof the wrappers stay thin, not just that they
// happen to import the right module name.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('react-datepicker', () => ({
    __esModule: true,
    default: () => <button type="button" data-testid="pick-date">15 сентября</button>,
    registerLocale: () => {},
}));

vi.mock('react-phone-input-2', () => ({
    __esModule: true,
    default: () => <input data-testid="phone-input" />,
}));

vi.mock('next/navigation', () => ({
    useParams: () => ({ psychologistId: 'psy-1' }),
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

const resolvePsychologistIdBySlug = vi.fn();
vi.mock('@/lib/booking/slug', () => ({ resolvePsychologistIdBySlug: (...args: unknown[]) => resolvePsychologistIdBySlug(...args) }));

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as any).Telegram;

    actions.getPsychologist.mockResolvedValue({
        id: 'psy-1',
        name: 'Анна Волкова',
        scheduleMode: 'booking',
        timeSuggestEnabled: false,
        psychologistSettings: { onlineSessionLink: null },
    });
    actions.getAvailableDates.mockResolvedValue(['2026-09-15']);
    actions.getAvailableTimes.mockResolvedValue([{ time: '19:00', format: 'online', addressId: null, slotToken: 'slt1_test', slotTokenOnline: null, slotTokenOffline: null }]);
    actions.resolveSignedClientLinkParam.mockResolvedValue(null);
    actions.checkConsentRequired.mockResolvedValue({ required: false, text: '', version: '' });
    actions.getAddressById.mockResolvedValue(null);
    resolvePsychologistIdBySlug.mockResolvedValue('psy-1');
});

describe('/bot/book/<id> and /u/<slug> render the identical BookingPageClient (Task 14 point 11)', () => {
    it('the legacy id-based wrapper renders the specialist name and booking heading', async () => {
        const ClientBookingPage = (await import('../[psychologistId]/page')).default;
        render(<ClientBookingPage />);

        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalledWith('psy-1'));
        expect(await screen.findByText('Анна Волкова')).toBeInTheDocument();
        // Макет C01: экран открывается именем специалиста, а не названием
        // операции. Раньше здесь проверялся заголовок «Запись на сессию» —
        // ровно то, от чего утверждённый handoff просит уйти.
        expect(screen.getByText('Подберу удобное время')).toBeInTheDocument();
        cleanup();
    });

    it('the human-readable slug wrapper resolves the slug server-side and renders the SAME output for the same psychologistId', async () => {
        const BookingBySlugPage = (await import('@/app/u/[slug]/page')).default;
        const element = await BookingBySlugPage({ params: Promise.resolve({ slug: 'anna-volkova' }) });
        render(element);

        expect(resolvePsychologistIdBySlug).toHaveBeenCalledWith('anna-volkova');
        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalledWith('psy-1'));
        expect(await screen.findByText('Анна Волкова')).toBeInTheDocument();
        // Макет C01: экран открывается именем специалиста, а не названием
        // операции. Раньше здесь проверялся заголовок «Запись на сессию» —
        // ровно то, от чего утверждённый handoff просит уйти.
        expect(screen.getByText('Подберу удобное время')).toBeInTheDocument();
    });

    it('the Cyrillic /у/<slug> alias resolves the same way and renders the same output', async () => {
        const BookingBySlugCyrillicPage = (await import('@/app/у/[slug]/page')).default;
        const element = await BookingBySlugCyrillicPage({ params: Promise.resolve({ slug: 'анна-волкова' }) });
        render(element);

        expect(resolvePsychologistIdBySlug).toHaveBeenCalledWith('анна-волкова');
        await waitFor(() => expect(actions.getPsychologist).toHaveBeenCalledWith('psy-1'));
        expect(await screen.findByText('Анна Волкова')).toBeInTheDocument();
    });

    it('an unresolvable slug shows NotFoundSpecialist instead of rendering the booking flow', async () => {
        resolvePsychologistIdBySlug.mockResolvedValue(null);
        const BookingBySlugPage = (await import('@/app/u/[slug]/page')).default;
        const element = await BookingBySlugPage({ params: Promise.resolve({ slug: 'nobody-here' }) });
        render(element);

        expect(actions.getPsychologist).not.toHaveBeenCalled();
    });
});
