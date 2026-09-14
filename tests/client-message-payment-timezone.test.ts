import { describe, it, expect } from 'vitest';
import { buildSessionClientMessage } from '@/lib/client-workflow';
import { buildClientOnboardingMessage } from '@/lib/practice/communications';
import { timezoneLabel, PRACTICE_TIMEZONES } from '@/lib/practice/timezones';
import { paymentInstructionText, paymentInstructionVariants } from '@/lib/messaging/payment-instruction';

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
            payment: {
                html: 'Оплата консультации производится по инструкции специалиста.',
                plain: 'Оплата консультации производится по инструкции специалиста.',
            },
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
            payment: {
                html: 'Оплата: по ссылке ниже.\n<a href="https://pay.example/1">Перейти к оплате</a>',
                plain: 'Оплата: по ссылке ниже.\nПерейти к оплате: https://pay.example/1',
            },
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

// ЖИВОЙ СЛУЧАЙ, 14.09.2026. Клиент получил в Telegram строку
// `<a href="https://qr.nspk.ru/…">Перейти к оплате</a>` — разметкой, буквой.
//
// Инструкция об оплате собиралась ВСЕГДА в HTML, а сообщение вокруг неё —
// дважды, в HTML и плоским текстом. В плоский вид разметка попадала как есть,
// а в HTML-виде сборщик экранировал вложенный текст целиком и превращал
// `<a>` в `&lt;a&gt;`. Ссылка была сломана в обоих видах, просто по-разному.
describe('ссылка на оплату в том же виде, что и сообщение (14.09.2026)', () => {
    const settings = {
        paymentText: 'Оплата по СБП.',
        paymentLink: 'https://qr.nspk.ru/AS1A002CT3HK7SQM8D2OMDRRG2QUHLLE',
        paymentQrUrl: null,
        prepaymentRequired: true,
        paymentDueText: null,
    };

    it('в плоском виде — подпись и адрес, без единого угла разметки', () => {
        const text = paymentInstructionText(settings, 'plain');
        expect(text).toContain('Перейти к оплате: https://qr.nspk.ru/');
        expect(text).not.toContain('<a');
        expect(text).not.toContain('</a>');
    });

    it('в разметке — настоящая ссылка', () => {
        const text = paymentInstructionText(settings, 'html');
        expect(text).toContain('<a href="https://qr.nspk.ru/AS1A002CT3HK7SQM8D2OMDRRG2QUHLLE">Перейти к оплате</a>');
    });

    it('слова специалиста не становятся разметкой', () => {
        const text = paymentInstructionText({ ...settings, paymentText: 'Счёт <b>только</b> на карту' }, 'html');
        expect(text).toContain('&lt;b&gt;');
        expect(text).not.toContain('<b>');
    });

    it('сообщение берёт тот вид, в котором строится само', () => {
        const payment = paymentInstructionVariants(settings);
        const plain = buildClientOnboardingMessage({
            clientName: 'Тигран',
            psychologistName: 'Мартынов Илья',
            bookingLink: 'https://cmpas.ru/u/ilya',
            payment,
            mode: 'plain',
        });
        expect(plain).not.toContain('<a');
        expect(plain).toContain('Перейти к оплате: https://qr.nspk.ru/');

        const html = buildClientOnboardingMessage({
            clientName: 'Тигран',
            psychologistName: 'Мартынов Илья',
            bookingLink: 'https://cmpas.ru/u/ilya',
            payment,
            mode: 'html',
        });
        // Экранированной разметки быть не должно: ровно это ломало ссылку.
        expect(html).not.toContain('&lt;a');
        expect(html).toContain('<a href="https://qr.nspk.ru/AS1A002CT3HK7SQM8D2OMDRRG2QUHLLE">Перейти к оплате</a>');
    });
});
