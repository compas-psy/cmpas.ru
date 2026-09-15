import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isQuietHour, QUIET_FROM_HOUR, QUIET_UNTIL_HOUR } from '@/lib/messaging/quiet-hours';

/**
 * НАПОМИНАНИЕ ЗА СУТКИ МОЛЧИТ НОЧЬЮ. НАПОМИНАНИЕ ЗА ЧАС — НЕТ.
 *
 * Дефект П4 книги 3. Правило «с 21:00 до 09:00 по поясу практики клиенту не
 * пишем» написано отдельным модулем, подробно объяснено и учитывает пояс
 * через системный календарь. Его спрашивали три задания: вопрос о
 * самочувствии, напоминание об оплате и пост-сессионный каскад. Четвёртое —
 * обычные напоминания о встрече, самое частое сообщение продукта, — не
 * спрашивало вовсе: модуль в него даже не импортировался.
 *
 * Встреча, назначенная на 22:30, давала клиенту напоминание в 22:15
 * накануне.
 *
 * Разделение здесь не косметическое: за ЧАС глушить нельзя. До встречи час,
 * и молчание в этом месте хуже звонка — человек просто её пропустит.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');
const source = read('src/lib/cron/reminders.ts');

/** Кусок файла между двумя выборками: суточный проход и часовой. */
const pass24 = source.slice(source.indexOf('sessions24'), source.indexOf('const sessions1 '));
const pass1 = source.slice(source.indexOf('const sessions1 '));

describe('суточное напоминание считается с тихими часами', () => {
    it('модуль тишины вообще импортирован — раньше его тут не было', () => {
        expect(source).toContain("from '@/lib/messaging/quiet-hours'");
    });

    it('суточный проход спрашивает тишину', () => {
        expect(pass24).toContain('isQuietHour(');
    });

    it('часовой проход тишину НЕ спрашивает', () => {
        // До встречи час: молчание здесь стоит человеку самой встречи.
        expect(pass1).not.toContain('isQuietHour(');
    });

    it('пропуск стоит до обеих отправок, а не только до клиентской', () => {
        // Иначе удачная отправка специалисту пометила бы сессию обработанной
        // (notified24h по общему итогу), и напоминание клиенту пропало бы
        // навсегда, а не отложилось до утра.
        const gate = pass24.indexOf('isQuietHour(');
        const toClient = pass24.indexOf("'session_24h_client'");
        const toPsychologist = pass24.indexOf('psychologistTelegramId');
        expect(gate).toBeGreaterThan(-1);
        expect(gate).toBeLessThan(toClient);
        expect(gate).toBeLessThan(toPsychologist);
    });

    it('час берётся по поясу практики, а не по серверному', () => {
        expect(pass24).toContain('psychologistSettings?.timezone');
    });
});

describe('границы тишины — те же, что у остальных заданий', () => {
    const at = (hour: number) => new Date(Date.UTC(2026, 8, 16, hour - 3, 0, 0)); // Москва = UTC+3

    it('в 22:15 по Москве — тишина', () => {
        expect(isQuietHour('Europe/Moscow', at(22))).toBe(true);
    });

    it('в 09:00 уже можно', () => {
        expect(isQuietHour('Europe/Moscow', at(QUIET_UNTIL_HOUR))).toBe(false);
    });

    it('в 21:00 уже нельзя', () => {
        expect(isQuietHour('Europe/Moscow', at(QUIET_FROM_HOUR))).toBe(true);
    });

    it('пояс практики и правда меняет ответ', () => {
        // Один и тот же миг — 18:30 UTC: во Владивостоке 04:30 (ночь), в
        // Калининграде 20:30 (ещё можно), в Москве 21:30 (уже нельзя).
        const moment = new Date(Date.UTC(2026, 8, 16, 18, 30, 0));
        expect(isQuietHour('Asia/Vladivostok', moment)).toBe(true);
        expect(isQuietHour('Europe/Moscow', moment)).toBe(true);
        expect(isQuietHour('Europe/Kaliningrad', moment)).toBe(false);
    });
});
