import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
    isQuietHour,
    hourInTimezone,
    weekdayInTimezone,
    QUIET_FROM_HOUR,
    QUIET_UNTIL_HOUR,
} from '@/lib/messaging/quiet-hours';

/**
 * Сообщение клиенту не приходит ночью.
 *
 * Живой путь, из-за которого это написано: каскад «через 2 часа после
 * встречи» идёт каждые полчаса и ничем не ограничен по времени суток.
 * Встреча, закончившаяся в 22:00, давала клиенту сообщение в полночь.
 *
 * Пояса клиента продукт не знает — его никто не спрашивает. Считаем по
 * поясу практики: встреча назначается в расписании специалиста, и клиент
 * подстраивается под его часы.
 */

/** 2026-09-11, 20:00 UTC = 23:00 в Москве, 13:00 в Лос-Анджелесе. */
const EVENING_UTC = new Date('2026-09-11T20:00:00Z');
/** 2026-09-11, 09:00 UTC = 12:00 в Москве, 19:00 во Владивостоке. */
const NOON_UTC = new Date('2026-09-11T09:00:00Z');

describe('тихие часы', () => {
    it('в Москве 23:00 — тишина', () => {
        expect(hourInTimezone('Europe/Moscow', EVENING_UTC)).toBe(23);
        expect(isQuietHour('Europe/Moscow', EVENING_UTC)).toBe(true);
    });

    it('в тот же миг в Калининграде 22:00 — тоже тишина', () => {
        expect(hourInTimezone('Europe/Kaliningrad', EVENING_UTC)).toBe(22);
        expect(isQuietHour('Europe/Kaliningrad', EVENING_UTC)).toBe(true);
    });

    it('днём молчать не надо', () => {
        expect(isQuietHour('Europe/Moscow', NOON_UTC)).toBe(false);
    });

    it('у практики во Владивостоке в тот же миг вечер, но ещё не ночь', () => {
        // 19:00 — до 21:00, сообщение допустимо. Именно ради таких случаев
        // час считается по поясу, а не по Москве.
        expect(hourInTimezone('Asia/Vladivostok', NOON_UTC)).toBe(19);
        expect(isQuietHour('Asia/Vladivostok', NOON_UTC)).toBe(false);
    });

    it('границы включают начало тишины и исключают её конец', () => {
        const at = (hour: number) => new Date(Date.UTC(2026, 8, 11, hour - 3, 0, 0)); // МСК = UTC+3
        expect(isQuietHour('Europe/Moscow', at(QUIET_FROM_HOUR))).toBe(true);
        expect(isQuietHour('Europe/Moscow', at(QUIET_FROM_HOUR - 1))).toBe(false);
        expect(isQuietHour('Europe/Moscow', at(QUIET_UNTIL_HOUR))).toBe(false);
        expect(isQuietHour('Europe/Moscow', at(QUIET_UNTIL_HOUR - 1))).toBe(true);
    });

    it('пустой и негодный пояс не роняют рассылку', () => {
        // Молчать из-за опечатки в настройке хуже, чем посчитать по Москве.
        expect(hourInTimezone(null, NOON_UTC)).toBe(hourInTimezone('Europe/Moscow', NOON_UTC));
        expect(hourInTimezone('', NOON_UTC)).toBe(hourInTimezone('Europe/Moscow', NOON_UTC));
        expect(hourInTimezone('Нет/Такого', NOON_UTC)).toBe(hourInTimezone('Europe/Moscow', NOON_UTC));
    });

    it('день недели тоже считается по поясу практики', () => {
        // Воскресенье 23:00 UTC — в Москве уже понедельник.
        const sundayLateUtc = new Date('2026-09-13T22:00:00Z');
        expect(weekdayInTimezone('Europe/Moscow', sundayLateUtc)).toBe(1);
        expect(weekdayInTimezone('Europe/Lisbon', sundayLateUtc)).toBe(7);
    });
});

describe('запрет стоит там, где уходят сообщения', () => {
    const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

    it('оба клиентских каскада спрашивают про тихий час', () => {
        const cascade = read('src/lib/cron/post-session-cascade.ts');
        // Два цикла: «через 2 часа» и «через неделю».
        expect(cascade.match(/quietNow\(session\.psychologistId/g)?.length).toBe(2);

        const moodCheck = read('src/lib/cron/post-session.ts');
        expect(moodCheck).toContain('isQuietHour(session.psychologist?.psychologistSettings?.timezone');
    });

    it('дайджесты специалисту идут по его часам, а не по московским', () => {
        const digest = read('src/lib/cron/digest.ts');
        expect(digest).toContain('MORNING_DIGEST_HOUR');
        expect(digest).toContain('weekdayInTimezone');

        // Расписание крона обязано быть почасовым: отбор по поясу внутри
        // задания бессмыслен, если само задание просыпается раз в сутки.
        const cron = read('src/instrumentation.ts');
        const morning = cron.slice(cron.indexOf("runExclusive('morning-digest'") - 200, cron.indexOf("runExclusive('morning-digest'"));
        expect(morning).toContain("cron.schedule('0 * * * *'");
    });
});
