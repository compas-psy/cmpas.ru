import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { orderNotificationText } from '@/lib/orders/notification';

/**
 * ЗАЯВКА НА ЕЖЕДНЕВНИК: СЛОВА ЧЕЛОВЕКА ДОХОДЯТ, УВЕДОМЛЕНИЕ УХОДИТ ОБЩИМ ПУТЁМ.
 *
 * Шаги 3 и 4 книги «Витрина и машинное отделение»: Ф3, Ф5 и заодно Ф4.
 *
 * Ф3. Поле «Сообщение» было на экране, подсказка звала написать главное —
 * количество экземпляров и вопрос по доставке, — форма это хранила, а
 * дальше текст исчезал: приём такого поля не принимал, колонки в таблице не
 * было, в уведомление он не попадал. Там же терялась метка посетителя.
 *
 * Ф5. Отправка шла своим запросом в api.telegram.org — четвёртой копией
 * после трёх в кабинете учредителя.
 *
 * Ф4. Форма собирала имя, телефон, адрес выхода в сеть и город, не сказав
 * об этом ни слова.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Только код: объяснение дефекта рядом не должно подтверждать само себя. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const actions = code(read('src/app/actions.ts'));
const form = read('src/components/psidairy/OrderForm.tsx');

describe('Ф3 · слова человека доходят до того, кто отвечает', () => {
    it('сообщение принимается приёмом заказа', () => {
        expect(actions).toContain('message?: string');
    });

    it('текст уведомления живёт отдельно от приёма — иначе его не проверить', () => {
        // В файле с «use server» каждый экспорт обязан быть асинхронным, и
        // сборка это проверяет; а текст, который читает человек, должен
        // проверяться без базы, сети и Telegram.
        expect(actions).toContain("@/lib/orders/notification");
        expect(code(read('src/lib/orders/notification.ts'))).not.toContain("'use server'");
    });

    it('сообщение сохраняется в заявке', () => {
        const fn = actions.slice(actions.indexOf('export async function submitOrder'));
        const create = fn.slice(fn.indexOf('db.order.create'), fn.indexOf('catch'));
        expect(create).toContain('message');
    });

    it('колонка заведена миграцией, а не только в схеме', () => {
        // Схема без миграции — это поле, которого на боевой базе нет.
        const migration = read('prisma/migrations/20260915180000_order_message/migration.sql');
        expect(migration).toContain('ALTER TABLE "Order" ADD COLUMN "message"');
    });

    it('сообщение отделено от пометок того, кто заказ обрабатывает', () => {
        // Сложить слова человека и слова оператора в одно поле значит
        // однажды потерять и то и другое.
        const schema = read('prisma/schema.prisma');
        const model = schema.slice(schema.indexOf('model Order {'));
        const body = model.slice(0, model.indexOf('\n}'));
        expect(body).toContain('message');
        expect(body).toContain('notes');
    });

    it('оно попадает в уведомление — и отдельным абзацем', () => {
        const text = orderNotificationText({
            name: 'Анна',
            phone: '+7 (900) 000-00-00',
            method: 'telegram',
            message: 'Нужно два экземпляра, доставка в Казань',
        });
        expect(text).toContain('Нужно два экземпляра, доставка в Казань');
        expect(text).toContain('Сообщение:');
        // Ради него человек открыл форму: он не должен теряться между полями.
        expect(text.indexOf('Сообщение:')).toBeGreaterThan(text.indexOf('Способ связи'));
    });

    it('пустое сообщение не создаёт пустого абзаца', () => {
        const text = orderNotificationText({ name: 'Анна', phone: '+7', method: 'max', message: '   ' });
        expect(text).not.toContain('Сообщение:');
    });

    it('метка посетителя передаётся формой — раньше поле в базе было всегда пустым', () => {
        expect(form).toContain('VISITOR_ID_COOKIE');
        expect(form).toContain('visitorId');
        expect(actions).toContain('visitorId: data.visitorId');
    });
});

describe('Ф3 · заказ читается там, где его обрабатывают', () => {
    it('экран заказов показывает сообщение', () => {
        // Хранить слова человека и не показывать их — тот же дефект, только
        // на шаг дальше.
        const page = read('src/app/admin/(chrome)/orders/page.tsx');
        expect(page).toContain('order.message');
    });
});

describe('Ф5 · уведомление уходит общим путём', () => {
    it('прямого запроса в Telegram не осталось', () => {
        expect(actions).not.toContain('api.telegram.org');
    });

    it('зовётся общая отправка — с прокси и таймаутом', () => {
        expect(actions).toContain("@/lib/telegram");
        expect(actions).toContain('sendTelegramMessage');
    });

    it('неудача доставки видна в журнале, а заявка всё равно сохранена', () => {
        // Человеку отвечаем успехом: его часть работы сделана. Но молча
        // терять уведомление нельзя.
        const fn = actions.slice(actions.indexOf('export async function submitOrder'));
        expect(fn).toContain('console.error');
        expect(fn.indexOf('db.order.create')).toBeLessThan(fn.indexOf('sendTelegramMessage'));
    });
});

describe('Ф5 · имя и сообщение экранируются', () => {
    it('амперсанд в имени не отменяет уведомление целиком', () => {
        // Тот же дефект, что чинился в массовой рассылке (У3): разметка
        // здесь HTML, и незакрытый символ рушит всё сообщение.
        const text = orderNotificationText({ name: 'Иванов & Ко', phone: '+7', method: 'max' });
        expect(text).toContain('Иванов &amp; Ко');
        expect(text).not.toContain('Иванов & Ко');
    });

    it('и разметка из сообщения не уходит разметкой', () => {
        const text = orderNotificationText({
            name: 'Анна', phone: '+7', method: 'max',
            message: '<b>срочно</b>',
        });
        expect(text).toContain('&lt;b&gt;срочно&lt;/b&gt;');
    });
});

describe('Ф4 · форма говорит, что собирает данные', () => {
    it('рядом с кнопкой есть строка о согласии', () => {
        expect(form).toContain('соглашаетесь на обработку');
    });

    it('и ссылка на политику — в самой форме, а не только в подвале страницы', () => {
        const formBody = form.slice(form.indexOf('Отправить заявку'));
        expect(formBody).toContain('/legal/privacy');
    });
});
