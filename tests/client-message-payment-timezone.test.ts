import { describe, it, expect } from 'vitest';
import { buildSessionClientMessage } from '@/lib/client-workflow';
import { buildClientOnboardingMessage } from '@/lib/practice/communications';
import { timezoneLabel, PRACTICE_TIMEZONES } from '@/lib/practice/timezones';

/**
 * Сценарий, который специалист до сих пор набирал руками.
 *
 * В переписке он выглядит так: время встречи, ссылка на видеовстречу,
 * «перед сессией немного формальностей» — подписать согласие и оплатить, —
 * и ссылки на то и другое. Всё это в продукте уже было, кроме двух вещей:
 *
 *   * времени без указания, ЧЬИ это часы;
 *   * оплаты у клиента, заведённого БЕЗ записи, — такому про оплату
 *     приходилось писать отдельным сообщением.
 */

const DATE = new Date('2026-09-12T00:00:00Z');

describe('сообщение о встрече', () => {
    it('называет часовой пояс практики', () => {
        const text = buildSessionClientMessage({
            clientName: 'Мартынов Илья',
            psychologistName: 'Анна Волкова',
            date: DATE,
            time: '11:00',
            format: 'online',
            bookingLink: 'https://cmpas.ru/u/anna',
            timezoneLabel: 'Москва (GMT+3)',
            mode: 'plain',
        });
        expect(text).toContain('11:00 (Москва (GMT+3))');
    });

    it('без пояса не выдумывает его', () => {
        // Пустой пояс — это «мы не знаем», и подставлять сюда Москву значит
        // сказать клиенту неправду ровно в том месте, ради которого строка и
        // появилась.
        const text = buildSessionClientMessage({
            clientName: 'Илья',
            psychologistName: 'Анна',
            date: DATE,
            time: '11:00',
            format: 'online',
            bookingLink: 'https://cmpas.ru/u/anna',
            mode: 'plain',
        });
        expect(text).toContain('11:00');
        expect(text).not.toContain('(GMT');
    });

    it('оплата стоит после документов, а не перед ними', () => {
        const text = buildSessionClientMessage({
            clientName: 'Илья',
            psychologistName: 'Анна',
            date: DATE,
            time: '11:00',
            format: 'online',
            documentLinks: [{ title: 'Информированное согласие', link: 'https://cmpas.ru/d/1' }],
            paymentText: 'Оплата консультации производится по инструкции специалиста.',
            bookingLink: 'https://cmpas.ru/u/anna',
            mode: 'plain',
        });
        expect(text.indexOf('Информированное согласие')).toBeLessThan(text.indexOf('Оплата консультации'));
    });
});

describe('сообщение клиенту без записи', () => {
    it('несёт инструкцию об оплате', () => {
        const text = buildClientOnboardingMessage({
            clientName: 'Илья',
            psychologistName: 'Анна',
            documentLinks: [{ title: 'Информированное согласие', link: 'https://cmpas.ru/d/1' }],
            bookingLink: 'https://cmpas.ru/u/anna',
            paymentText: 'Оплата: по ссылке ниже.\nПерейти к оплате: https://pay.example/1',
            mode: 'plain',
        });
        expect(text).toContain('Перейти к оплате');
        // Ссылка на управление записями остаётся последней строкой: это
        // действие, а не справка.
        expect(text.trim().endsWith('Управлять записями можно здесь: https://cmpas.ru/u/anna')).toBe(true);
    });

    it('без настроенной оплаты про неё не говорит', () => {
        const text = buildClientOnboardingMessage({
            clientName: 'Илья',
            psychologistName: 'Анна',
            bookingLink: 'https://cmpas.ru/u/anna',
            mode: 'plain',
        });
        expect(text).not.toContain('Оплат');
    });
});

describe('список поясов — один на всех', () => {
    it('имя пояса берётся из общего списка', () => {
        expect(timezoneLabel('Europe/Moscow')).toBe('Москва (GMT+3)');
        expect(PRACTICE_TIMEZONES.some(tz => tz.value === 'Europe/Moscow')).toBe(true);
    });

    it('незнакомый пояс отдаётся как есть, а не подменяется', () => {
        // Омск в списке есть; берём зону, которой там заведомо нет.
        expect(timezoneLabel('Antarctica/Vostok')).toBe('Antarctica/Vostok');
        expect(timezoneLabel(null)).toBe('');
    });

    it('экран настроек берёт тот же список, а не свою копию', async () => {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const page = readFileSync(join(__dirname, '..', 'src/app/diary/settings/page.tsx'), 'utf-8');
        expect(page).toContain("from '@/lib/practice/timezones'");
        // Вторая копия списка разошлась бы с первой молча.
        expect(page).not.toContain("{ value: 'Europe/Moscow'");
    });
});
