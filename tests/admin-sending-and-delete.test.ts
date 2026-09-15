import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plural } from '@/lib/ru-plural';

/**
 * ДЕЙСТВИЯ УЧРЕДИТЕЛЯ: ОТПРАВКА И УДАЛЕНИЕ.
 *
 * Дефекты У3, У4, У5, У6 и У10 книги учредителя. У его кабинета нет второго
 * человека, который заметит ошибку: над ним никого. Поэтому правила, которые
 * на пути специалиста просто удобны, здесь единственная защита.
 *
 * Проверяется правило по исходникам: воспроизводить массовую рассылку в
 * тесте дороже и опаснее, чем стеречь то, что однажды разошлось.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Только код: объяснение дефекта рядом не должно подтверждать само себя. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const crm = code(read('src/app/admin/actions/crm.ts'));
const users = code(read('src/app/admin/actions/users.ts'));

describe('админка не отправляет в обход правил продукта', () => {
    it('прямых запросов в Telegram не осталось ни одного', () => {
        // Их было три: рассылка, личное сообщение из CRM и сообщение из
        // досье. Каждая своей копией, все мимо прокси и таймаута.
        for (const [name, source] of [['crm.ts', crm], ['users.ts', users]] as const) {
            expect(source, `${name} всё ещё ходит в Telegram напрямую`)
                .not.toContain('api.telegram.org');
        }
    });

    it('отправка идёт общим путём', () => {
        expect(crm).toContain("from \"@/lib/telegram\"");
        expect(users).toContain("@/lib/messaging/deliver");
    });

    it('сообщение из досье достаёт и того, у кого только MAX', () => {
        // Раньше отвечало «не привязан Telegram» и молчало про MAX.
        expect(users).toContain('maxChatId');
        expect(users).not.toContain('У пользователя не привязан Telegram');
    });
});

describe('массовая рассылка', () => {
    it('экранирует подстановки — иначе амперсанд в имени отменит письмо', () => {
        expect(crm).toContain('escapeHtml(user.name');
        expect(crm).toContain('escapeHtml(user.email');
    });

    it('делает паузу между сообщениями', () => {
        // У Telegram предел около тридцати в секунду; цикл без пауз упирался
        // в него на первой же сотне.
        expect(crm).toMatch(/setTimeout\(resolve, \d+\)/);
    });

    it('пишет строку и на неудачу, с причиной', () => {
        // Раньше строка создавалась только после успеха и всегда со статусом
        // «доставлено»: у недоставленного письма не оставалось ни следа, ни
        // причины, и повторить попытку было не для кого.
        expect(crm).toContain("status: outcome.ok ? 'delivered' : 'failed'");
        expect(crm).toContain('errorMsg: outcome.error');
    });

    it('причины отказов попадают в журнал действия', () => {
        expect(crm).toContain('reasons');
    });

    it('в журнал действия не уходит ни имени, ни адреса', () => {
        // Журнал читает человек и хранит его долго; персональным данным там
        // делать нечего — они и так есть в AdminMessage по получателю.
        const payload = crm.slice(crm.indexOf("action: 'mass_communication'"));
        const logged = payload.slice(0, payload.indexOf('})'));
        expect(logged).not.toContain('user.name');
        expect(logged).not.toContain('user.email');
    });
});

describe('удаление аккаунта', () => {
    it('снимок делается ДО удаления', () => {
        const fn = users.slice(users.indexOf('export async function deleteUserAccount'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        const snapshot = body.indexOf('deleteUserImpact');
        const remove = body.indexOf('db.user.delete');
        expect(snapshot).toBeGreaterThan(-1);
        expect(remove).toBeGreaterThan(-1);
        // Иначе считать будет уже нечего: строки не станет.
        expect(snapshot).toBeLessThan(remove);
    });

    it('запись журнала помнит, что исчезло', () => {
        expect(users).toContain("logAction(adminId, 'delete', userId, impact");
    });

    it('снимок называет человека и числа', () => {
        const fn = users.slice(users.indexOf('export async function deleteUserImpact'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        for (const field of ['email', 'name', 'clients', 'sessions']) {
            expect(body, `в снимке нет поля ${field}`).toContain(field);
        }
    });

    it('подтверждение называет человека, а не кричит заглавными', () => {
        const actions = code(read('src/app/admin/(chrome)/users/user-actions.tsx'));
        expect(actions).not.toContain('УДАЛИТЬ АККАУНТ НАВСЕГДА');
        expect(actions).toContain('deleteUserImpact');
        // Второй вопрос — ввод почты: он разрывает привычку жать «OK» не читая.
        expect(actions).toContain('введите почту аккаунта');
    });

    it('удаление защищено не слабее тестового сброса', () => {
        const actions = code(read('src/app/admin/(chrome)/users/user-actions.tsx'));
        const del = actions.slice(actions.indexOf('deleteUserImpact'));
        const block = del.slice(0, del.indexOf('deleteUserAccount(user.id)'));
        // Два шага: вопрос с числами и подтверждение почтой.
        expect(block).toContain('confirm(');
        expect(block).toContain('prompt(');
    });
});

describe('экран интереса к функциям говорит, чего не видит', () => {
    const page = read('src/app/admin/(chrome)/feature-interest/page.tsx');

    it('больше не обещает, что видит веб', () => {
        // Только код: объяснение дефекта рядом называет прежнюю подпись
        // своими словами — и не должно из-за этого ронять проверку.
        expect(code(page)).not.toContain('Android/web');
    });

    it('называет свою слепую зону прямо на экране', () => {
        expect(page).toContain('только тех, у кого стоит приложение');
    });
});

describe('склонение на кнопке рассылки — из общего правила', () => {
    it('экран зовёт общий модуль', () => {
        const page = read('src/app/admin/(chrome)/communications/page.tsx');
        expect(page).toContain("from '@/lib/ru-plural'");
        expect(code(page)).not.toMatch(/\?\s*'е'\s*:/);
    });

    it('и правда считает верно там, где короткая редакция врала', () => {
        expect(plural(21, 'сообщение', 'сообщения', 'сообщений')).toBe('сообщение');
        expect(plural(22, 'сообщение', 'сообщения', 'сообщений')).toBe('сообщения');
        expect(plural(11, 'сообщение', 'сообщения', 'сообщений')).toBe('сообщений');
    });
});
