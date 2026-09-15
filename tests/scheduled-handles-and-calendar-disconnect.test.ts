import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { moscowDayWindow, reconciliationReport } from '@/lib/cron/payment-reconciliation';
import { shouldNudgeForSettledSession } from '@/lib/session-maintenance';

/**
 * ДВЕРЬ, КОТОРАЯ НЕ ОТКРЫВАЛАСЬ, И ТРИ ЗАДАЧИ, КОТОРЫХ НИКТО НЕ ЗВАЛ.
 *
 * Шаги 1 и 2 книги «Витрина и машинное отделение»: Ф9, Ф11, Ф12, Ф13.
 *
 * Общее у всех четырёх — отказ, которого не видно. Кнопка «Отключить
 * календарь» падала с ошибкой базы и говорила одно слово «Ошибка». Три
 * задачи были написаны, покрыты тестами и не вызывались ниоткуда: у
 * несработавшего фонового процесса нет жалобщика, и выглядит он ровно так
 * же, как «сегодня нечего было делать».
 *
 * Поэтому здесь два вида проверок: чистые функции сверки проверяются по
 * поведению, а вызовы и порядок удаления — по исходникам. Воспроизводить
 * каскадное удаление и внешний API банка в тесте дороже и опаснее, чем
 * стеречь то, что однажды уже сломалось молча.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Только код: объяснение дефекта рядом не должно подтверждать само себя. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const settings = code(read('src/app/diary/actions/settings.ts'));
const users = code(read('src/app/admin/actions/users.ts'));
const instrumentation = code(read('src/instrumentation.ts'));

describe('Ф9 · отключение календаря', () => {
    it('связи удаляются раньше подключения — иначе база запрещает', () => {
        const fn = settings.slice(settings.indexOf('export async function disconnectIntegration'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        const links = body.indexOf('calendarSessionLink.deleteMany');
        const integration = body.indexOf('calendarIntegration.delete');
        expect(links, 'связи не удаляются вовсе').toBeGreaterThan(-1);
        expect(integration).toBeGreaterThan(-1);
        expect(links).toBeLessThan(integration);
    });

    it('и то и другое — одной транзакцией', () => {
        // Иначе отказ на втором шаге оставит подключение без связей: события
        // в чужом календаре станут ничьими, и убрать их будет уже нечем.
        const fn = settings.slice(settings.indexOf('export async function disconnectIntegration'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        expect(body).toContain('db.$transaction');
    });

    it('запрет в схеме остаётся — он и значит «сначала реши про связи»', () => {
        // Сторож с двух сторон: если запрет однажды заменят на каскад, этот
        // тест упадёт и напомнит, что явные удаления выше стали лишними.
        const schema = read('prisma/schema.prisma');
        const model = schema.slice(schema.indexOf('model CalendarSessionLink'));
        const body = model.slice(0, model.indexOf('\n}'));
        expect(body).toContain('CalendarIntegration @relation(fields: [integrationId], references: [id], onDelete: Restrict)');
    });
});

describe('Ф9 · удаление аккаунта не зависит от порядка каскада', () => {
    it('связи и подключения удаляются явно и до удаления пользователя', () => {
        const fn = users.slice(users.indexOf('export async function deleteUserAccount'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        const links = body.indexOf('calendarSessionLink.deleteMany');
        const integrations = body.indexOf('calendarIntegration.deleteMany');
        const user = body.indexOf('db.user.delete');
        expect(links).toBeGreaterThan(-1);
        expect(integrations).toBeGreaterThan(-1);
        expect(links).toBeLessThan(integrations);
        expect(integrations).toBeLessThan(user);
    });
});

describe('три задачи получили расписание', () => {
    /** Строка расписания рядом с именем задачи. */
    const scheduleOf = (name: string) => {
        const at = instrumentation.indexOf(`runExclusive('${name}'`);
        expect(at, `задача ${name} не зарегистрирована`).toBeGreaterThan(-1);
        const line = instrumentation.slice(instrumentation.lastIndexOf('cron.schedule', at), at);
        return line.match(/cron\.schedule\('([^']+)'/)?.[1] ?? '';
    };

    it('закрытие прошедших встреч — каждые 15 минут', () => {
        // Раньше это делало только приложение: у работающего в вебе встречи
        // не закрывались никогда, и недельное письмо не уходило вовсе.
        expect(scheduleOf('settle-past-sessions')).toBe('*/15 * * * *');
        expect(instrumentation).toContain('settlePastSessionsForAllPsychologists');
    });

    it('первый проход не заваливает специалиста напоминаниями за три месяца', () => {
        // Встречу закрываем любой давности, а напоминаем только про
        // недавние: у работающего в вебе к этому дню накопились месяцы
        // незакрытых встреч.
        expect(instrumentation).toContain('nudgeWindowDays: 2');
    });

    it('окно считается по концу встречи, а без окна — как раньше', () => {
        const now = new Date('2026-09-15T12:00:00Z');
        const yesterday = new Date('2026-09-14T12:00:00Z');
        const threeMonthsAgo = new Date('2026-06-15T12:00:00Z');
        expect(shouldNudgeForSettledSession(yesterday, now, 2)).toBe(true);
        expect(shouldNudgeForSettledSession(threeMonthsAgo, now, 2)).toBe(false);
        // Приложение зовёт без окна: его поведение этой правкой не меняется.
        expect(shouldNudgeForSettledSession(threeMonthsAgo, now, null)).toBe(true);
    });

    it('мобильный вызов закрытия сохранён — он делает список точным сразу', () => {
        expect(code(read('src/app/api/mobile/dashboard/route.ts'))).toContain('settlePastSessionsForPsychologist');
        expect(code(read('src/app/api/mobile/sessions/route.ts'))).toContain('settlePastSessionsForPsychologist');
    });

    it('погашение приглашений и черновиков — раз в час', () => {
        // В черновике лежат имя и телефон человека, который согласия не
        // давал. Час — это обещание, и держится оно на этом вызове.
        expect(scheduleOf('expire-invites-and-drafts')).toBe('0 * * * *');
        expect(instrumentation).toContain('expireClientChannelInvites');
        expect(instrumentation).toContain('expireContactIntakeDrafts');
    });

    it('сверка с банком — раз в сутки и утром', () => {
        const schedule = scheduleOf('payment-reconciliation');
        const [minute, hour, ...rest] = schedule.split(' ');
        expect(rest.join(' '), 'сверка должна быть суточной, а не чаще').toBe('* * *');
        expect(Number(hour)).toBeGreaterThanOrEqual(3); // 06 UTC = 09 МСК
        expect(Number(minute), 'минута не нулевая — чтобы не совпасть с другими суточными задачами').toBeGreaterThan(0);
    });
});

describe('Ф11 · сверка докладывает, но ничего не чинит', () => {
    const source = code(read('src/lib/cron/payment-reconciliation.ts'));

    it('не пишет в платежи ни одной строкой', () => {
        // Решение из шапки scripts/reconcile-tinkoff.ts: расхождение — это
        // P0, который должен увидеть человек, а не то, что тихо само себя
        // чинит. Автоматизирован только факт, что сверку сегодня сделали.
        for (const write of ['payment.update', 'payment.create', 'payment.delete', 'payment.upsert']) {
            expect(source, `сверка пытается чинить: ${write}`).not.toContain(write);
        }
    });

    it('доклад уходит общим путём отправки, а не своим запросом', () => {
        expect(source).not.toContain('api.telegram.org');
        expect(source).toContain("@/lib/telegram");
    });

    it('сверяются все настроенные терминалы, а не один', () => {
        expect(source).toContain('paymentTerminals()');
    });

    it('на демонстрационном терминале сверка не идёт', () => {
        // Боевых платежей там не бывает, и доклад «у банка ничего нет» был
        // бы ложной тревогой каждое утро.
        expect(source).toContain('isDemoTerminal()');
    });
});

describe('Ф11 · окно выборки — сутки, а не мгновение', () => {
    it('день берётся целиком', () => {
        // В скрипте `from` и `to` были одним и тем же моментом: условие
        // попадало ровно в одну миллисекунду, и сверка сравнивала выписку
        // банка с пустым списком наших платежей.
        const { from, to } = moscowDayWindow(new Date('2026-09-14T12:00:00Z'));
        expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
    });

    it('границы — московские сутки, потому что даты у банка московские', () => {
        const { from, to, label } = moscowDayWindow(new Date('2026-09-14T12:00:00Z'));
        expect(label).toBe('2026-09-14');
        expect(from.toISOString()).toBe('2026-09-13T21:00:00.000Z');
        expect(to.toISOString()).toBe('2026-09-14T20:59:59.999Z');
    });

    it('поздний вечер по Москве остаётся тем же днём', () => {
        // 23:30 МСК 14-го — это уже 20:30 UTC того же дня; ошибка здесь
        // сдвинула бы сверку на сутки и «потеряла» вечерние платежи.
        expect(moscowDayWindow(new Date('2026-09-14T20:30:00Z')).label).toBe('2026-09-14');
        expect(moscowDayWindow(new Date('2026-09-14T21:30:00Z')).label).toBe('2026-09-15');
    });
});

describe('Ф11 · что именно говорит доклад', () => {
    const empty = { matched: 12, missingInStatement: [], missingInDb: [], amountMismatches: [] };

    it('день сошёлся — человека не будят', () => {
        expect(reconciliationReport('site', '2026-09-14', empty)).toBeNull();
    });

    it('оплачено у нас, в выписке нет — называется и заказом, и суммой', () => {
        const text = reconciliationReport('site', '2026-09-14', {
            ...empty,
            missingInStatement: [{ orderId: 'order-7', tinkoffPaymentId: '900', amount: 149000, status: 'paid' }],
        });
        expect(text).toContain('order-7');
        expect(text).toContain('1490');
        expect(text).toContain('расхождений — 1');
    });

    it('банк принял, у нас не отмечено — тот самый случай шести платежей из девяти', () => {
        const text = reconciliationReport('site', '2026-09-14', {
            ...empty,
            missingInDb: [{ paymentId: '901', orderId: 'order-8', amount: 149000, status: 'CONFIRMED' }],
        });
        expect(text).toContain('901');
        expect(text).toContain('order-8');
    });

    it('разошедшиеся суммы показаны обе', () => {
        const text = reconciliationReport('site', '2026-09-14', {
            ...empty,
            amountMismatches: [{
                payment: { orderId: 'order-9', tinkoffPaymentId: '902', amount: 149000, status: 'paid' },
                operation: { paymentId: '902', orderId: 'order-9', amount: 100000, status: 'CONFIRMED' },
            }],
        });
        expect(text).toContain('1490');
        expect(text).toContain('1000');
    });

    it('доклад прямо говорит, что сам ничего не исправил', () => {
        const text = reconciliationReport('app', '2026-09-14', {
            ...empty,
            missingInDb: [{ paymentId: '903', amount: 149000, status: 'CONFIRMED' }],
        });
        expect(text).toContain('ничего не исправляет');
    });
});
