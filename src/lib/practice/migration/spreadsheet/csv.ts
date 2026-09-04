// Task 13: a real CSV/TSV parser — not `split(',')`. Handles UTF-8 BOM,
// auto-detects the delimiter (comma/semicolon/tab) from the header line, and
// respects RFC4180 quoting (quoted fields, doubled "" for a literal quote,
// embedded newlines inside a quoted field). Delimiter counting and the field
// tokenizer both track quote state so a delimiter character inside a quoted
// cell is never mistaken for a real column break.

export type CsvDelimiter = ',' | ';' | '\t';

export interface DelimitedTable {
    headers: string[];
    /** Data rows only — fully blank rows (every cell empty after trim) are dropped. */
    rows: string[][];
    delimiter: CsvDelimiter;
}

function stripBom(text: string): string {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function countOutsideQuotes(line: string, ch: string): number {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && c === ch) count++;
    }
    return count;
}

export function detectDelimiter(text: string): CsvDelimiter {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const candidates: CsvDelimiter[] = [',', ';', '\t'];
    let best: CsvDelimiter = ',';
    let bestCount = -1;
    for (const d of candidates) {
        const count = countOutsideQuotes(firstLine, d);
        if (count > bestCount) {
            bestCount = count;
            best = d;
        }
    }
    return best;
}

/** Tokenizes the whole text into rows of raw (already-unquoted) fields, given one delimiter. */
function tokenize(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let sawAnyContentInRow = false;
    let i = 0;
    const n = text.length;

    while (i < n) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            field += ch;
            i++;
            continue;
        }
        if (ch === '"' && field === '') {
            inQuotes = true;
            sawAnyContentInRow = true;
            i++;
            continue;
        }
        if (ch === delimiter) {
            row.push(field);
            field = '';
            sawAnyContentInRow = true;
            i++;
            continue;
        }
        if (ch === '\r') {
            i++;
            continue;
        }
        if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            sawAnyContentInRow = false;
            i++;
            continue;
        }
        field += ch;
        if (field.trim() !== '') sawAnyContentInRow = true;
        i++;
    }
    if (field.length > 0 || row.length > 0 || sawAnyContentInRow) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

export function parseDelimitedTable(rawText: string, delimiterOverride?: CsvDelimiter): DelimitedTable {
    const text = stripBom(rawText ?? '');
    const delimiter = delimiterOverride ?? detectDelimiter(text);
    const allRows = tokenize(text, delimiter);
    const nonBlank = allRows.filter((r) => r.some((cell) => cell.trim() !== ''));
    const [headerRow, ...dataRows] = nonBlank;
    return {
        headers: (headerRow ?? []).map((h) => h.trim()),
        rows: dataRows,
        delimiter,
    };
}
