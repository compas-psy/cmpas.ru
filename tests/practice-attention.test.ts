// Задача 17 — общий Action Center (src/lib/practice/attention.ts).
//
// Проверяется три вещи: пункт называет КОНКРЕТНЫЙ объект (а не счётчик),
// пункт исчезает сам, как только проблему решили (состояние вычисляемое, без
// read-state), и ни один запрос не выходит за пределы текущего специалиста.
//
// Вместо заглушки-«отвечает что попало» здесь маленькая поддельная база: она
// применяет те же фильтры, что и настоящая (consentDate, статус, оплата,
// статусы элементов импорта). Только так тест на исчезновение пункта что-то
// значит — иначе он проверял бы сам себя.

import { describe, it, expect, vi, beforeEach } from 'vitest';

type SessionRow = {
    id: string;
    psychologistId: string;
    clientId: string;
    status: string;
    date: Date;
    notes: string | null;
    clientSummary: string | null;
    structuredNotes: unknown;
    paymentStatus: string;
    client: { id: string; name: string } | null;
};

type ClientRow = { id: string; psychologistId: string; name: string; consentDate: Date | null; status: string };
type ImportItemRow = { batchId: string; status: string };
type BatchRow = { id: string; psychologistId: string; sourceType: string; status: string; createdAt: Date };

const world = vi.hoisted(() => ({
    sessions: [] as SessionRow[],
    clients: [] as ClientRow[],
    batches: [] as BatchRow[],
    importItems: [] as ImportItemRow[],
    /** Каждый psychologistId, с которым база вообще что-либо спрашивали. */
    scopes: [] as string[],
}));

type SessionWhere = { psychologistId: string; status?: string; date?: { gte?: Date; lte?: Date } };
type ClientWhere = { psychologistId: string; consentDate?: Date | null; status?: string };
type BatchWhere = { psychologistId: string; status?: { notIn?: string[] } };

function matchesRange(value: Date, range?: { gte?: Date; lte?: Date }) {
    if (!range) return true;
    if (range.gte && value < range.gte) return false;
    if (range.lte && value > range.lte) return false;
    return true;
}

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: vi.fn(async ({ where }: { where: SessionWhere }) => {
                world.scopes.push(where.psychologistId);
                return world.sessions.filter(s =>
                    s.psychologistId === where.psychologistId
                    && (!where.status || s.status === where.status)
                    && matchesRange(s.date, where.date));
            }),
        },
        diaryClient: {
            findMany: vi.fn(async ({ where }: { where: ClientWhere }) => {
                world.scopes.push(where.psychologistId);
                return world.clients.filter(c =>
                    c.psychologistId === where.psychologistId
                    && (where.consentDate !== null || c.consentDate === null)
                    && (!where.status || c.status === where.status));
            }),
        },
        practiceImportBatch: {
            findMany: vi.fn(async ({ where }: { where: BatchWhere }) => {
                world.scopes.push(where.psychologistId);
                const needsReview = (batchId: string) =>
                    world.importItems.filter(i => i.batchId === batchId && ['pending', 'error'].includes(i.status));
                return world.batches
                    .filter(b => b.psychologistId === where.psychologistId)
                    .filter(b => !where.status?.notIn?.includes(b.status))
                    .filter(b => needsReview(b.id).length > 0)
                    .map(b => ({ ...b, _count: { items: needsReview(b.id).length } }));
            }),
        },
        // paymentStatus живёт вне схемы Prisma, поэтому модуль читает его
        // сырым запросом. Поддельная база достаёт psychologistId из
        // параметров запроса — заодно это проверка, что он туда передан.
        $queryRaw: vi.fn(async (sql: { values: unknown[] }) => {
            const psychologistId = String(sql.values[0]);
            world.scopes.push(psychologistId);
            const now = sql.values[1] as Date;
            return world.sessions
                .filter(s => s.psychologistId === psychologistId
                    && s.status === 'completed'
                    && s.paymentStatus === 'unpaid'
                    && s.date <= now)
                .map(s => ({ id: s.id, clientId: s.clientId, date: s.date, name: s.client?.name ?? null }));
        }),
    },
}));

const { getPracticeAttention } = await import('@/lib/practice/attention');

const NOW = new Date('2026-09-04T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function session(over: Partial<SessionRow> = {}): SessionRow {
    return {
        id: 's-1', psychologistId: 'psy-1', clientId: 'c-1', status: 'completed', date: daysAgo(2),
        notes: null, clientSummary: null, structuredNotes: null, paymentStatus: 'not_required',
        client: { id: 'c-1', name: 'Анна' },
        ...over,
    };
}

beforeEach(() => {
    world.sessions = [];
    world.clients = [];
    world.batches = [];
    world.importItems = [];
    world.scopes = [];
});

describe('пункт называет конкретный объект, а не счётчик', () => {
    it('session_without_notes отдаёт sessionId и clientId', async () => {
        world.sessions = [session({ id: 's-note', clientId: 'c-7', client: { id: 'c-7', name: 'Анна' } })];

        const [item] = await getPracticeAttention('psy-1', NOW);

        expect(item.type).toBe('session_without_notes');
        expect(item.sessionId).toBe('s-note');
        expect(item.clientId).toBe('c-7');
        expect(item.label).toContain('Анна');
        expect(item.label).toContain('нет заметки по сессии');
    });

    it('client_without_consent отдаёт clientId', async () => {
        world.clients = [{ id: 'c-9', psychologistId: 'psy-1', name: 'Мария', consentDate: null, status: 'active' }];

        const [item] = await getPracticeAttention('psy-1', NOW);

        expect(item.type).toBe('client_without_consent');
        expect(item.clientId).toBe('c-9');
        expect(item.sessionId).toBeUndefined();
        expect(item.label).toContain('Мария');
    });

    it('session_unpaid отдаёт sessionId и clientId и берёт настоящий paymentStatus', async () => {
        world.sessions = [
            // status='pending' — это НЕ про оплату, такой пункт появляться не должен.
            session({ id: 's-pending', status: 'pending', paymentStatus: 'not_required' }),
            session({ id: 's-unpaid', clientId: 'c-3', paymentStatus: 'unpaid', notes: 'есть заметка', client: { id: 'c-3', name: 'Борис' } }),
        ];

        const items = await getPracticeAttention('psy-1', NOW);

        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('session_unpaid');
        expect(items[0].sessionId).toBe('s-unpaid');
        expect(items[0].clientId).toBe('c-3');
        expect(items[0].label).toContain('не отмечена оплата');
    });

    it('import_review отдаёт batchId и источник импорта', async () => {
        world.batches = [{ id: 'b-1', psychologistId: 'psy-1', sourceType: 'calendar', status: 'preview', createdAt: daysAgo(1) }];
        world.importItems = [{ batchId: 'b-1', status: 'pending' }, { batchId: 'b-1', status: 'imported' }];

        const [item] = await getPracticeAttention('psy-1', NOW);

        expect(item.type).toBe('import_review');
        expect(item.batchId).toBe('b-1');
        expect(item.importSource).toBe('calendar');
        expect(item.sessionId).toBeUndefined();
        expect(item.clientId).toBeUndefined();
    });

    it('у каждого пункта есть идентификатор объекта — счётчиков в выдаче нет', async () => {
        world.sessions = [session({ id: 's-a' }), session({ id: 's-b', paymentStatus: 'unpaid', notes: 'ок' })];
        world.clients = [{ id: 'c-9', psychologistId: 'psy-1', name: 'Мария', consentDate: null, status: 'active' }];
        world.batches = [{ id: 'b-1', psychologistId: 'psy-1', sourceType: 'spreadsheet', status: 'committed', createdAt: NOW }];
        world.importItems = [{ batchId: 'b-1', status: 'error' }];

        const items = await getPracticeAttention('psy-1', NOW);

        expect(items).toHaveLength(4);
        for (const item of items) {
            expect(item.sessionId || item.clientId || item.batchId).toBeTruthy();
            expect(item.id).toContain(item.type);
            expect(item).not.toHaveProperty('count');
        }
    });
});

describe('состояние вычисляемое: решили проблему — пункт исчез на следующем обновлении', () => {
    it('добавили заметку — пункт про заметку уходит', async () => {
        world.sessions = [session({ id: 's-note' })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(1);

        world.sessions = [session({ id: 's-note', notes: 'Работали с тревогой' })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('структурированная заметка засчитывается наравне с текстовой', async () => {
        world.sessions = [session({ id: 's-note', structuredNotes: [{ values: { focus: 'план на месяц' } }] })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('появилось согласие — пункт про согласие уходит', async () => {
        world.clients = [{ id: 'c-9', psychologistId: 'psy-1', name: 'Мария', consentDate: null, status: 'active' }];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(1);

        world.clients = [{ id: 'c-9', psychologistId: 'psy-1', name: 'Мария', consentDate: NOW, status: 'active' }];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('отметили оплату — пункт про оплату уходит', async () => {
        world.sessions = [session({ id: 's-unpaid', paymentStatus: 'unpaid', notes: 'ок' })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(1);

        world.sessions = [session({ id: 's-unpaid', paymentStatus: 'paid', notes: 'ок' })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('разобрали импорт — пункт про импорт уходит', async () => {
        world.batches = [{ id: 'b-1', psychologistId: 'psy-1', sourceType: 'calendar', status: 'committed', createdAt: NOW }];
        world.importItems = [{ batchId: 'b-1', status: 'error' }];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(1);

        world.importItems = [{ batchId: 'b-1', status: 'imported' }];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('откатанный импорт не требует разбора', async () => {
        world.batches = [{ id: 'b-1', psychologistId: 'psy-1', sourceType: 'calendar', status: 'rolled_back', createdAt: NOW }];
        world.importItems = [{ batchId: 'b-1', status: 'pending' }];

        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });

    it('давняя сессия без заметки — уже история, а не задача на сегодня', async () => {
        world.sessions = [session({ id: 's-old', date: daysAgo(40) })];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });
});

describe('§9 Ownership', () => {
    it('чужие объекты не попадают в выдачу', async () => {
        world.sessions = [session({ id: 's-mine' }), session({ id: 's-alien', psychologistId: 'psy-2' })];
        world.clients = [
            { id: 'c-mine', psychologistId: 'psy-1', name: 'Мария', consentDate: null, status: 'active' },
            { id: 'c-alien', psychologistId: 'psy-2', name: 'Чужая', consentDate: null, status: 'active' },
        ];
        world.batches = [{ id: 'b-alien', psychologistId: 'psy-2', sourceType: 'calendar', status: 'preview', createdAt: NOW }];
        world.importItems = [{ batchId: 'b-alien', status: 'pending' }];

        const items = await getPracticeAttention('psy-1', NOW);

        expect(items.map(i => i.sessionId ?? i.clientId ?? i.batchId).sort()).toEqual(['c-mine', 's-mine']);
    });

    it('каждый запрос ушёл с идентификатором текущего специалиста — включая сырой SQL про оплату', async () => {
        await getPracticeAttention('psy-1', NOW);

        expect(world.scopes.length).toBe(4);
        expect(new Set(world.scopes)).toEqual(new Set(['psy-1']));
    });

    it('архивного клиента не поднимаем в задачи', async () => {
        world.clients = [{ id: 'c-old', psychologistId: 'psy-1', name: 'Архив', consentDate: null, status: 'archived' }];
        expect(await getPracticeAttention('psy-1', NOW)).toHaveLength(0);
    });
});
