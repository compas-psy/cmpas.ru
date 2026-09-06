// Task 13 §9/§11/§12/§14/§22: preview orchestration — parse -> normalize ->
// matchClientIdentity -> bucket. A name alone is never an identity; strong
// (phone/email) matches auto-resolve; rows never silently disappear.
import { describe, it, expect } from 'vitest';
import {
    buildClientOnlyPreviewFromLines,
    buildClientOnlyPreviewFromTable,
    buildSessionPreviewFromTable,
    type PreviewContext,
} from '../src/lib/practice/migration/spreadsheet/preview';

function ctx(overrides: Partial<PreviewContext> = {}): PreviewContext {
    return { existingClients: [], addresses: [], defaultDuration: 50, ...overrides };
}

describe('buildClientOnlyPreviewFromLines — §9/§22 "paste — clients"', () => {
    const EXAMPLE = `Анна Иванова, +79161234567, anna@example.com
Михаил Петров; +79031112233
Ольга Смирнова
Дмитрий Новиков  +7 (903) 555-77-88  d.novikov@mail.ru`;

    it('parses every example line into a ready new-client row', () => {
        const rows = buildClientOnlyPreviewFromLines(EXAMPLE, ctx());
        expect(rows).toHaveLength(4);
        expect(rows.every((r) => r.bucket === 'ready')).toBe(true);
        expect(rows[0]).toMatchObject({ name: 'Анна Иванова', phone: '+79161234567', email: 'anna@example.com' });
        expect(rows[1]).toMatchObject({ name: 'Михаил Петров', phone: '+79031112233' });
        expect(rows[2]).toMatchObject({ name: 'Ольга Смирнова', phone: null });
        expect(rows[3]).toMatchObject({ name: 'Дмитрий Новиков' });
    });

    it('a row without a recognizable name is an error, never silently dropped', () => {
        const rows = buildClientOnlyPreviewFromLines('x\nАнна Иванова', ctx());
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ bucket: 'error', errorCode: 'MISSING_NAME' });
        expect(rows[1].bucket).toBe('ready');
    });

    it('blank lines are ignored', () => {
        const rows = buildClientOnlyPreviewFromLines('Анна Иванова\n\n\nМихаил Петров', ctx());
        expect(rows).toHaveLength(2);
    });
});

describe('identity matching — §11/§12', () => {
    it('a unique phone match resolves to the existing client', () => {
        const rows = buildClientOnlyPreviewFromLines('Аня, +79161234567', ctx({ existingClients: [{ id: 'c1', name: 'Анна', phone: '+79161234567' }] }));
        expect(rows[0]).toMatchObject({ bucket: 'skipped', errorCode: 'ALREADY_EXISTS', resolvedClientId: 'c1' });
    });

    it('a unique email match resolves to the existing client', () => {
        const rows = buildClientOnlyPreviewFromLines('Аня, anna@example.com', ctx({ existingClients: [{ id: 'c1', name: 'Анна', email: 'anna@example.com' }] }));
        expect(rows[0]).toMatchObject({ bucket: 'skipped', resolvedClientId: 'c1' });
    });

    it('a name-only match against an existing client is review, never auto-selected', () => {
        const rows = buildClientOnlyPreviewFromLines('Иван Иванов', ctx({ existingClients: [{ id: 'c1', name: 'Иван Иванов' }] }));
        expect(rows[0]).toMatchObject({ bucket: 'review', errorCode: 'NAME_ONLY_COLLISION', resolvedClientId: null, suggestedClientId: 'c1' });
    });

    it('same name, different phones within one upload are never silently merged — the second goes to review, not an auto-decision either way', () => {
        // matchClientIdentity's own (Task 11) contract: a shared name PLUS a
        // phone that does NOT match that same-named candidate is a conflict,
        // not a silent merge and not a silent "definitely different person"
        // either — the psychologist confirms. Both rows stay visible.
        const rows = buildClientOnlyPreviewFromLines('Иван Иванов, +79000000001\nИван Иванов, +79000000002', ctx());
        expect(rows[0].bucket).toBe('ready');
        expect(rows[1]).toMatchObject({ bucket: 'review', errorCode: 'CLIENT_IDENTITY_CONFLICT' });
    });

    it('differently formatted versions of the same phone are recognized as one identity (second is a duplicate skip)', () => {
        const rows = buildClientOnlyPreviewFromLines('Иван Иванов, +7 900 000-00-01\nИван Иванов, 89000000001', ctx());
        expect(rows[0].bucket).toBe('ready');
        expect(rows[1]).toMatchObject({ bucket: 'skipped', errorCode: 'ALREADY_EXISTS' });
    });

    it('phone and email pointing to two different existing clients is a conflict', () => {
        const rows = buildClientOnlyPreviewFromLines('Аня, +79161234567, other@example.com', ctx({
            existingClients: [
                { id: 'c1', name: 'Анна', phone: '+79161234567' },
                { id: 'c2', name: 'Другая', email: 'other@example.com' },
            ],
        }));
        expect(rows[0]).toMatchObject({ bucket: 'review', errorCode: 'CLIENT_IDENTITY_CONFLICT' });
    });
});

describe('buildClientOnlyPreviewFromTable — §4/§22 CSV/XLSX client columns', () => {
    it('resolves aliased headers and validates phone/email', () => {
        const { rows, unusedHeaders } = buildClientOnlyPreviewFromTable(['ФИО', 'Телефон', 'Почта', 'Источник'], [
            ['Анна Иванова', '+79161234567', 'anna@example.com', 'excel'],
            ['', '+79161234567', '', 'excel'],
            ['Петр Петров', 'not-a-phone', '', 'excel'],
            ['Олег Олегов', '', 'not-an-email', 'excel'],
        ], ctx());
        expect(unusedHeaders).toEqual(['Источник']);
        expect(rows[0].bucket).toBe('ready');
        expect(rows[1]).toMatchObject({ bucket: 'error', errorCode: 'MISSING_NAME' });
        expect(rows[2]).toMatchObject({ bucket: 'error', errorCode: 'INVALID_PHONE' });
        expect(rows[3]).toMatchObject({ bucket: 'error', errorCode: 'INVALID_EMAIL' });
    });
});

describe('buildSessionPreviewFromTable — §5/§14/§22 spreadsheet sessions', () => {
    const headers = ['ФИО', 'Телефон', 'Дата', 'Время', 'Длительность', 'Формат'];

    it('a valid unmatched client is ready as a new client + session', () => {
        const result = buildSessionPreviewFromTable(headers, [
            ['Анна Иванова', '+79161234567', '12.09.2026', '15:00', '50', 'онлайн'],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).toMatchObject({ bucket: 'ready', name: 'Анна Иванова', date: '2026-09-12', startTime: '15:00', duration: 50, format: 'online' });
    });

    it('an existing strong match resolves the client automatically', () => {
        const result = buildSessionPreviewFromTable(headers, [
            ['Анна', '+79161234567', '12.09.2026', '15:00', '50', 'online'],
        ], ctx({ existingClients: [{ id: 'c1', name: 'Анна Иванова', phone: '+79161234567' }] }));
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).toMatchObject({ bucket: 'ready', resolvedClientId: 'c1' });
    });

    it('offline with an owned, unambiguous cabinet resolves addressId', () => {
        const withAddr = [...headers, 'Кабинет'];
        const result = buildSessionPreviewFromTable(withAddr, [
            ['Анна', '+79161234567', '12.09.2026', '15:00', '50', 'очно', 'Центр'],
        ], ctx({ addresses: [{ id: 'addr-1', name: 'Центр', address: 'ул. Ленина, 10' }] }));
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).toMatchObject({ bucket: 'ready', format: 'offline', addressId: 'addr-1' });
    });

    it('offline without a cabinet column value is not ready', () => {
        const withAddr = [...headers, 'Кабинет'];
        const result = buildSessionPreviewFromTable(withAddr, [
            ['Анна', '+79161234567', '12.09.2026', '15:00', '50', 'очно', ''],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).toMatchObject({ bucket: 'review', errorCode: 'ADDRESS_REQUIRED' });
    });

    it('an unrecognized cabinet name is not ready (review, not silently rejected/dropped)', () => {
        const withAddr = [...headers, 'Кабинет'];
        const result = buildSessionPreviewFromTable(withAddr, [
            ['Анна', '+79161234567', '12.09.2026', '15:00', '50', 'очно', 'Чужой кабинет'],
        ], ctx({ addresses: [{ id: 'addr-1', name: 'Центр', address: 'ул. Ленина, 10' }] }));
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).toMatchObject({ bucket: 'review', errorCode: 'ADDRESS_NOT_FOUND' });
    });

    it('duration is computed from end_time when duration column is absent', () => {
        const withEnd = ['ФИО', 'Телефон', 'Дата', 'Начало', 'Окончание', 'Формат'];
        const result = buildSessionPreviewFromTable(withEnd, [
            ['Анна', '+79161234567', '12.09.2026', '15:00', '15:50', 'online'],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0].duration).toBe(50);
    });

    it('falls back to the configured default duration when neither duration nor end_time exist', () => {
        const minimal = ['ФИО', 'Дата', 'Начало'];
        const result = buildSessionPreviewFromTable(minimal, [['Анна', '12.09.2026', '15:00']], ctx({ defaultDuration: 60 }));
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0].duration).toBe(60);
    });

    it('reports NO_DATE_TIME_COLUMNS when date/start_time cannot be identified', () => {
        const result = buildSessionPreviewFromTable(['ФИО', 'Заметка'], [['Анна', 'что-то']], ctx());
        expect(result).toEqual({ errorCode: 'NO_DATE_TIME_COLUMNS' });
    });

    it('the same normalized row twice in one upload -> the second is DUPLICATE_SOURCE_ROW', () => {
        const result = buildSessionPreviewFromTable(headers, [
            ['Анна Иванова', '+79161234567', '12.09.2026', '15:00', '50', 'online'],
            ['Анна Иванова', '89161234567', '12.09.2026', '15:00', '50', 'online'],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0].bucket).toBe('ready');
        expect(result.rows[1]).toMatchObject({ bucket: 'skipped', errorCode: 'DUPLICATE_SOURCE_ROW' });
    });

    it('the same client at a different non-overlapping time is allowed twice', () => {
        const result = buildSessionPreviewFromTable(headers, [
            ['Анна Иванова', '+79161234567', '12.09.2026', '15:00', '50', 'online'],
            ['Анна Иванова', '+79161234567', '12.09.2026', '16:00', '50', 'online'],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0].bucket).toBe('ready');
        expect(result.rows[1].bucket).toBe('ready');
        expect(result.rows[0].sourceFingerprint).not.toBe(result.rows[1].sourceFingerprint);
    });

    it('source row text never leaks anywhere but preview fields (no notes field exists on the row at all)', () => {
        const result = buildSessionPreviewFromTable(headers, [
            ['Анна Иванова', '+79161234567', '12.09.2026', '15:00', '50', 'online'],
        ], ctx());
        if ('errorCode' in result) throw new Error('unexpected column error');
        expect(result.rows[0]).not.toHaveProperty('notes');
    });
});
