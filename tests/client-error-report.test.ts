// След клиентской аварии: что попадает в журнал и чего в нём быть не может.
//
// Серверная ошибка оставляет строку и отпечаток, по которому её находят за
// минуту. Клиентская до 10.09.2026 не оставляла ничего — и когда учредитель
// сообщил, что в мобильном вебе при клике на клиента возникает ошибка,
// спросить оказалось не у чего: воспроизвести не удалось, а следа не было.
//
// Цена такого следа — риск утечь персональными данными в журнал. Поэтому
// здесь проверяется не только то, что отчёт доходит, но и то, что из него
// вычищено.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/db', () => ({ db: {} }));
const track = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

function request(body: unknown) {
    return new Request('http://localhost/api/client-error', {
        method: 'POST',
        body: JSON.stringify(body),
    }) as never;
}

let logged: string[] = [];

beforeEach(() => {
    vi.clearAllMocks();
    logged = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
    });
});

describe('POST /api/client-error', () => {
    it('авария доходит до журнала: имя, текст, верхний кадр, путь', async () => {
        const { POST } = await import('@/app/api/client-error/route');

        await POST(request({
            name: 'TypeError',
            message: "Cannot read properties of undefined (reading 'filter')",
            frame: 'at RepeatSlotPanel (page-abc.js:1:2)',
            path: '/diary/clients',
        }));

        expect(logged.join(' ')).toContain('TypeError');
        expect(logged.join(' ')).toContain('RepeatSlotPanel');
        expect(logged.join(' ')).toContain('/diary/clients');
    });

    it('строка запроса не попадает в журнал — в ней ходят идентификаторы клиентов', async () => {
        const { POST } = await import('@/app/api/client-error/route');

        await POST(request({ name: 'Error', message: 'x', path: '/diary/clients?clientId=cl_abc123#tab' }));

        expect(logged.join(' ')).toContain('/diary/clients');
        expect(logged.join(' ')).not.toContain('cl_abc123');
    });

    it('почта и длинные цепочки цифр вычищаются из текста ошибки', async () => {
        // Сообщение об ошибке иногда несёт значение, а значением бывает
        // телефон клиента. Журнал — не место для него.
        const { POST } = await import('@/app/api/client-error/route');

        await POST(request({
            name: 'Error',
            message: 'Invalid value ivan@example.com for +79991234567',
            path: '/diary',
        }));

        const line = logged.join(' ');
        expect(line).not.toContain('ivan@example.com');
        expect(line).not.toContain('79991234567');
        expect(line).toContain('<почта>');
        expect(line).toContain('<цифры>');
    });

    it('без учётной записи событие аналитики не пишется', async () => {
        // device_id без согласия на аналитику мы не пишем; журнал при этом
        // всё равно получает строку — она и есть главное.
        const { POST } = await import('@/app/api/client-error/route');

        await POST(request({ name: 'Error', message: 'x', path: '/' }));

        expect(track).not.toHaveBeenCalled();
        expect(logged.length).toBe(1);
    });

    it('мусор вместо отчёта не роняет обработчик', async () => {
        const { POST } = await import('@/app/api/client-error/route');

        const res = await POST(new Request('http://localhost/api/client-error', { method: 'POST', body: 'не json' }) as never);

        expect(res.status).toBe(200);
    });
});

// ── Экран аварии действительно отправляет отчёт ──
//
// Маршрут можно написать и оставить неподключённым — тогда мы снова окажемся
// без следа, но с ощущением, что след есть. Отправка живёт в эффекте, а
// эффекты при отрисовке на сервере не выполняются, поэтому здесь проверяется
// две вещи: экран не печатает человеку строку запроса (в ней идентификатор
// клиента) и вызов отправки в нём есть, причём путь берётся без запроса.

describe('экран «Страница не открылась»', () => {
    it('не показывает строку запроса и шлёт отчёт по pathname, а не по href', async () => {
        const React = await import('react');
        const { renderToStaticMarkup } = await import('react-dom/server');
        const AppError = (await import('@/app/error')).default;
        const error = Object.assign(new Error('boom'), { digest: 'abc123' });

        const markup = renderToStaticMarkup(React.createElement(AppError, { error, reset: () => {} }));
        expect(markup).not.toContain('clientId');

        const source = readFileSync('src/app/error.tsx', 'utf8');
        expect(source).toContain("fetch('/api/client-error'");
        expect(source).toContain('window.location.pathname');
        expect(source).not.toContain('window.location.href');
    });
});
