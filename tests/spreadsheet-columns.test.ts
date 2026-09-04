// Task 13 §4/§5/§22: header alias resolution — trim + case-insensitive,
// column order never meaningful, unused columns reported (no silent data loss).
import { describe, it, expect } from 'vitest';
import { resolveColumns, CLIENT_COLUMN_ALIASES, SESSION_COLUMN_ALIASES } from '../src/lib/practice/migration/spreadsheet/columns';

describe('resolveColumns — client-only aliases', () => {
    it('maps Russian aliases regardless of column order', () => {
        const { mapping, unusedHeaders } = resolveColumns(['Телефон', 'ФИО', 'Почта'], CLIENT_COLUMN_ALIASES);
        expect(mapping).toEqual({ phone: 0, name: 1, email: 2 });
        expect(unusedHeaders).toEqual([]);
    });

    it('maps English aliases, trim + case-insensitive', () => {
        const { mapping } = resolveColumns(['  Client Name ', 'MOBILE', 'E-Mail'], CLIENT_COLUMN_ALIASES);
        expect(mapping).toEqual({ name: 0, phone: 1, email: 2 });
    });

    it('reports unrecognized columns as unused', () => {
        const { unusedHeaders } = resolveColumns(['имя', 'заметка', 'источник'], CLIENT_COLUMN_ALIASES);
        expect(unusedHeaders).toEqual(['заметка', 'источник']);
    });
});

describe('resolveColumns — session aliases', () => {
    it('maps date/time/duration/format/address aliases', () => {
        const headers = ['ФИО', 'Дата', 'Время начала', 'Окончание', 'Длительность', 'Формат', 'Кабинет'];
        const { mapping, unusedHeaders } = resolveColumns(headers, SESSION_COLUMN_ALIASES);
        expect(mapping).toEqual({ name: 0, date: 1, start_time: 2, end_time: 3, duration: 4, format: 5, address: 6 });
        expect(unusedHeaders).toEqual([]);
    });

    it('does not require optional columns to be present', () => {
        const { mapping } = resolveColumns(['name', 'date', 'start'], SESSION_COLUMN_ALIASES);
        expect(mapping.name).toBe(0);
        expect(mapping.date).toBe(1);
        expect(mapping.start_time).toBe(2);
        expect(mapping.end_time).toBeUndefined();
        expect(mapping.duration).toBeUndefined();
    });
});
