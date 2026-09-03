// @vitest-environment jsdom
//
// Task 8 (founder review, UI regression fix) — regression case 4 for the
// client self-service reschedule page: "click option B → server gets token
// B". Mirrors src/app/diary/components/__tests__/RescheduleModal.test.tsx
// for the psychologist-facing modal.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const actions = vi.hoisted(() => ({
    getAvailableDatesForClientReschedule: vi.fn(),
    getAvailableTimesForClientReschedule: vi.fn(),
    submitClientReschedule: vi.fn(),
}));
vi.mock('../actions', () => actions);

const botActions = vi.hoisted(() => ({
    getAddressById: vi.fn(),
}));
vi.mock('@/app/bot/actions', () => botActions);

import { RescheduleClient } from '../RescheduleClient';

beforeEach(() => {
    vi.clearAllMocks();
    actions.getAvailableDatesForClientReschedule.mockResolvedValue(['2026-09-15']);
    actions.submitClientReschedule.mockResolvedValue({ date: '15 сентября', time: '15:00' });
    botActions.getAddressById.mockResolvedValue({ name: 'Яузская', address: 'ул. Яузская, 1' });
});

async function renderAndPickDate() {
    render(
        <RescheduleClient
            sessionId="session-1"
            token="link-token"
            initial={{ date: '2026-09-01', time: '10:00', clientName: 'Мария', psychologistName: 'Анна' }}
        />
    );
    await waitFor(() => expect(actions.getAvailableDatesForClientReschedule).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('15'));
    await waitFor(() => expect(actions.getAvailableTimesForClientReschedule).toHaveBeenCalled());
}

describe('RescheduleClient — exact-slot identity per option (Task 8 UI regression fix)', () => {
    it('same time, online + offline: clicking the offline option sends ITS token, not the online one', async () => {
        actions.getAvailableTimesForClientReschedule.mockResolvedValue([
            { time: '15:00', format: 'online', addressId: null, slotToken: 'slt1_online', slotTokenOnline: null, slotTokenOffline: null },
            { time: '15:00', format: 'offline', addressId: 'addr-yauzskaya', slotToken: 'slt1_offline', slotTokenOnline: null, slotTokenOffline: null },
        ]);

        await renderAndPickDate();

        await screen.findByText('Онлайн');
        const offlineOption = (await screen.findByText(/Очно/)).closest('button')!;
        expect(screen.getAllByText('15:00')).toHaveLength(2);

        fireEvent.click(offlineOption);
        fireEvent.click(screen.getByRole('button', { name: /Перенести встречу/ }));

        await waitFor(() => expect(actions.submitClientReschedule).toHaveBeenCalledWith('session-1', 'link-token', 'slt1_offline'));
        expect(actions.submitClientReschedule).not.toHaveBeenCalledWith('session-1', 'link-token', 'slt1_online');
    });

    it("format:'both' renders explicit online AND offline options — no silent default", async () => {
        actions.getAvailableTimesForClientReschedule.mockResolvedValue([
            { time: '15:00', format: 'both', addressId: 'addr-yauzskaya', slotToken: null, slotTokenOnline: 'slt1_both-online', slotTokenOffline: 'slt1_both-offline' },
        ]);

        await renderAndPickDate();

        await screen.findByText('Онлайн');
        fireEvent.click((await screen.findByText(/Очно/)).closest('button')!);
        fireEvent.click(screen.getByRole('button', { name: /Перенести встречу/ }));

        await waitFor(() => expect(actions.submitClientReschedule).toHaveBeenCalledWith('session-1', 'link-token', 'slt1_both-offline'));
    });
});
