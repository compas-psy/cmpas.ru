// @vitest-environment jsdom
//
// Task 8 (founder review, UI regression fix) — regression case 4: "click
// option B → server gets token B". RescheduleModal used to render one button
// per TIME and silently pick a token for it; this proves that when the same
// clock time carries two distinct bookable options (online vs. an offline
// office), clicking the SECOND one sends its own distinct slotToken to
// rescheduleSession — never the first option's token, and never a
// silently-defaulted one.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const actions = vi.hoisted(() => ({
    getAvailableDatesForReschedule: vi.fn(),
    getAvailableTimesForReschedule: vi.fn(),
    rescheduleSession: vi.fn(),
}));
vi.mock('@/app/diary/actions/sessions', () => actions);

const botActions = vi.hoisted(() => ({
    getAddressById: vi.fn(),
}));
vi.mock('@/app/bot/actions', () => botActions);

import { RescheduleModal } from '../RescheduleModal';

beforeEach(() => {
    vi.clearAllMocks();
    actions.getAvailableDatesForReschedule.mockResolvedValue(['2026-09-15']);
    actions.rescheduleSession.mockResolvedValue({ id: 'session-1' });
    botActions.getAddressById.mockResolvedValue({ name: 'Яузская', address: 'ул. Яузская, 1' });
});

async function openAndPickDate() {
    render(
        <RescheduleModal
            isOpen
            onClose={() => {}}
            onSave={() => {}}
            sessionId="session-1"
            currentDate="2026-09-01"
            currentTime="10:00"
            clientName="Мария"
        />
    );
    await waitFor(() => expect(actions.getAvailableDatesForReschedule).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('15'));
    await waitFor(() => expect(actions.getAvailableTimesForReschedule).toHaveBeenCalled());
}

describe('RescheduleModal — exact-slot identity per option (Task 8 UI regression fix)', () => {
    it('same time, online + offline: renders two distinct options and clicking the offline one sends ITS token', async () => {
        actions.getAvailableTimesForReschedule.mockResolvedValue([
            { time: '15:00', format: 'online', addressId: null, slotToken: 'slt1_online', slotTokenOnline: null, slotTokenOffline: null },
            { time: '15:00', format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_offline', slotTokenOnline: null, slotTokenOffline: null },
        ]);

        await openAndPickDate();

        const online = await screen.findByText('Онлайн');
        await screen.findByText(/Очно/);
        // Two distinct "15:00" buttons exist — one per option, not collapsed to one.
        expect(screen.getAllByText('15:00')).toHaveLength(2);

        const offlineButton = screen.getByText(/Очно/).closest('button')!;
        fireEvent.click(offlineButton);

        const submitButton = screen.getByRole('button', { name: /Перенести$/ });
        fireEvent.click(submitButton);

        await waitFor(() => expect(actions.rescheduleSession).toHaveBeenCalledWith('session-1', 'slt1_offline'));
        expect(actions.rescheduleSession).not.toHaveBeenCalledWith('session-1', 'slt1_online');
    });

    it("format:'both' renders explicit online AND offline options — no silent default", async () => {
        actions.getAvailableTimesForReschedule.mockResolvedValue([
            { time: '15:00', format: 'both', addressId: 'addr-yauzskaya', slotToken: null, slotTokenOnline: 'slt1_both-online', slotTokenOffline: 'slt1_both-offline' },
        ]);

        await openAndPickDate();

        await screen.findByText('Онлайн');
        await screen.findByText(/Очно/);

        fireEvent.click(screen.getByText(/Очно/).closest('button')!);
        fireEvent.click(screen.getByRole('button', { name: /Перенести$/ }));

        await waitFor(() => expect(actions.rescheduleSession).toHaveBeenCalledWith('session-1', 'slt1_both-offline'));
    });

    it('same time, two DIFFERENT offices: both render distinctly and each sends its own token', async () => {
        botActions.getAddressById.mockImplementation((id: string) =>
            Promise.resolve(id === 'addr-1' ? { name: 'Яузская', address: '' } : { name: 'Тверская', address: '' })
        );
        actions.getAvailableTimesForReschedule.mockResolvedValue([
            { time: '15:00', format: 'offline', addressId: 'addr-1', slotToken: 'slt1_office-a', slotTokenOnline: null, slotTokenOffline: null },
            { time: '15:00', format: 'offline', addressId: 'addr-2', slotToken: 'slt1_office-b', slotTokenOnline: null, slotTokenOffline: null },
        ]);

        await openAndPickDate();

        await screen.findByText(/Яузская/);
        const tverskaya = await screen.findByText(/Тверская/);

        fireEvent.click(tverskaya.closest('button')!);
        fireEvent.click(screen.getByRole('button', { name: /Перенести$/ }));

        await waitFor(() => expect(actions.rescheduleSession).toHaveBeenCalledWith('session-1', 'slt1_office-b'));
    });
});
