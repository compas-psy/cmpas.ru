import { describe, it, expect } from 'vitest';
import { build24hReminderText } from '@/lib/cron/reminder-text';

describe('build24hReminderText (product/practice/CJM_booking_v1.md §1.3, closes B-260816-02)', () => {
    it('never names the specialist or says психолог', () => {
        const text = build24hReminderText({
            clientName: 'Мария', time: '19:00', format: 'online',
            onlineLink: 'https://meet.example/abc', confirmationRequired: true,
        });
        expect(text).not.toMatch(/психолог/i);
        expect(text).not.toContain('Иван Иванов'); // no specialist name is ever passed in — the function has no field for it
    });

    it('includes the video link only for online format', () => {
        const online = build24hReminderText({ clientName: 'М', time: '19:00', format: 'online', onlineLink: 'https://x', confirmationRequired: false });
        expect(online).toContain('https://x');

        const offline = build24hReminderText({ clientName: 'М', time: '19:00', format: 'offline', addressName: 'Кабинет 3', confirmationRequired: false });
        expect(offline).not.toContain('🔗');
        expect(offline).toContain('Кабинет 3');
    });

    it('asks for confirmation only when the session is still pending', () => {
        const pending = build24hReminderText({ clientName: 'М', time: '19:00', format: 'online', confirmationRequired: true });
        expect(pending).toContain('Пожалуйста, подтвердите');

        const confirmed = build24hReminderText({ clientName: 'М', time: '19:00', format: 'online', confirmationRequired: false });
        expect(confirmed).toContain('уже подтверждена');
    });
});
