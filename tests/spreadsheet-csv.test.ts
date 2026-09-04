// Task 13 §3/§22: a real CSV/TSV parser — comma/semicolon/tab
// auto-detection, RFC4180 quoting, UTF-8 BOM, blank rows ignored.
import { describe, it, expect } from 'vitest';
import { parseDelimitedTable, detectDelimiter } from '../src/lib/practice/migration/spreadsheet/csv';

describe('parseDelimitedTable', () => {
    it('parses comma-delimited CSV', () => {
        const table = parseDelimitedTable('name,phone\nАнна,+79161234567\nМихаил,+79031112233');
        expect(table.delimiter).toBe(',');
        expect(table.headers).toEqual(['name', 'phone']);
        expect(table.rows).toEqual([['Анна', '+79161234567'], ['Михаил', '+79031112233']]);
    });

    it('parses semicolon-delimited CSV', () => {
        const table = parseDelimitedTable('name;phone\nАнна;+79161234567');
        expect(table.delimiter).toBe(';');
        expect(table.rows).toEqual([['Анна', '+79161234567']]);
    });

    it('parses TSV', () => {
        const table = parseDelimitedTable('name\tphone\nАнна\t+79161234567');
        expect(table.delimiter).toBe('\t');
        expect(table.rows).toEqual([['Анна', '+79161234567']]);
    });

    it('handles quoted values containing the delimiter itself', () => {
        const table = parseDelimitedTable('name,note\n"Иванов, Иван","Says ""hi"" often"');
        expect(table.rows[0]).toEqual(['Иванов, Иван', 'Says "hi" often']);
    });

    it('handles a quoted field with an embedded newline', () => {
        const table = parseDelimitedTable('name,note\n"Иван","line1\nline2"\nПетр,ok');
        expect(table.rows[0]).toEqual(['Иван', 'line1\nline2']);
        expect(table.rows[1]).toEqual(['Петр', 'ok']);
    });

    it('strips a UTF-8 BOM before parsing', () => {
        const withBom = '﻿name,phone\nАнна,+79161234567';
        const table = parseDelimitedTable(withBom);
        expect(table.headers).toEqual(['name', 'phone']);
    });

    it('ignores fully blank rows', () => {
        const table = parseDelimitedTable('name,phone\nАнна,+79161234567\n\n   \nМихаил,+79031112233');
        expect(table.rows).toHaveLength(2);
    });

    it('detectDelimiter picks the delimiter with the most occurrences outside quotes', () => {
        expect(detectDelimiter('a;b;c')).toBe(';');
        expect(detectDelimiter('a\tb\tc')).toBe('\t');
        expect(detectDelimiter('a,b,c')).toBe(',');
        expect(detectDelimiter('"a,b",c;d;e')).toBe(';'); // comma inside quotes doesn't count
    });
});
