// Находка сверх аудита: q_lamp_reminders (morning.ts) и q_practice_reminders
// (products.ts) читают одни и те же поля ОДНОГО показания InfraPulse
// (remindersDue, remindersSent), но раньше расходились ровно на
// remindersDue === 0 — лампа отвечала no_data («за сутки не было ни одного
// напоминания к отправке»), а карточка продукта на тех же цифрах — ok.
// Панель не имеет права спорить сама с собой на одном и том же показании.
//
// Обе функции теперь читают показание через общую readReminders()
// (queries/infra.ts), так что их состояние физически не может разойтись —
// но этот тест проверяет именно ПОВЕДЕНИЕ (не реализацию): один и тот же
// мок-объект показания подаётся в обе функции, и их state обязан совпасть.
// Если кто-то в будущем снова заведёт в одной из функций отдельную ветку
// интерпретации remindersDue, этот тест покраснеет первым.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
vi.mock('@/lib/db', () => ({ db: { infraPulse: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));

import { qLampReminders } from '@/lib/panel/queries/morning';
import { qPracticeReminders } from '@/lib/panel/queries/products';

beforeEach(() => {
    findFirst.mockReset();
});

/** Одно и то же показание — оба запроса читают его независимо, поэтому мок нужен на каждый вызов. */
function mockPulseTwice(row: Record<string, unknown>) {
    const full = { collectedAt: new Date(), ...row };
    findFirst.mockResolvedValueOnce(full).mockResolvedValueOnce(full);
}

describe('q_lamp_reminders и q_practice_reminders согласованы на одном показании InfraPulse', () => {
    it('коллектор не присылал ничего — оба no_data', async () => {
        findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

        const [lamp, practice] = await Promise.all([qLampReminders(), qPracticeReminders()]);
        expect(lamp.state).toBe('no_data');
        expect(practice.state).toBe('no_data');
    });

    it('remindersDue ещё null (коллектор старше миграции ReminderOutbox) — оба no_data', async () => {
        mockPulseTwice({ remindersDue: null, remindersSent: null, remindersSentTwice: null });

        const [lamp, practice] = await Promise.all([qLampReminders(), qPracticeReminders()]);
        expect(lamp.state).toBe('no_data');
        expect(practice.state).toBe('no_data');
    });

    it('remindersDue = 0 — честный ноль дня без дедлайнов: оба НЕ no_data (это и есть находка — раньше здесь расходились)', async () => {
        mockPulseTwice({ remindersDue: 0, remindersSent: 0, remindersSentTwice: 0 });

        const [lamp, practice] = await Promise.all([qLampReminders(), qPracticeReminders()]);
        expect(lamp.state).not.toBe('no_data');
        expect(practice.state).not.toBe('no_data');
        expect(lamp.state).toBe(practice.state);
        expect(lamp.state).toBe('ok');
    });

    it('remindersDue > 0 с реальными числами — оба ok и согласны по состоянию', async () => {
        mockPulseTwice({ remindersDue: 20, remindersSent: 18, remindersSentTwice: 1 });

        const [lamp, practice] = await Promise.all([qLampReminders(), qPracticeReminders()]);
        expect(lamp.state).toBe('ok');
        expect(practice.state).toBe('ok');
        expect(practice.data).toMatchObject({ due: 20, sent: 18, sentTwice: 1 });
    });

    it('показание устарело (> 30 минут) — оба stale, не ok и не no_data', async () => {
        const old = new Date(Date.now() - 60 * 60000);
        findFirst
            .mockResolvedValueOnce({ collectedAt: old, remindersDue: 20, remindersSent: 18, remindersSentTwice: 1 })
            .mockResolvedValueOnce({ collectedAt: old, remindersDue: 20, remindersSent: 18, remindersSentTwice: 1 });

        const [lamp, practice] = await Promise.all([qLampReminders(), qPracticeReminders()]);
        expect(lamp.state).toBe('stale');
        expect(practice.state).toBe('stale');
    });
});
