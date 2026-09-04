// Task 13: preview/route.ts — parses csv/paste/xlsx, fetches psychologist
// context (clients/addresses/default duration), and delegates entirely to
// the pure orchestration in spreadsheet/preview.ts (unit-tested separately
// in tests/spreadsheet-preview.test.ts). This covers the route's own glue:
// content-type branching, sheet-selection requirement, and error passthrough.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const diaryClientFindMany = vi.fn();
const addressFindMany = vi.fn();
const settingsFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: { findMany: (...args: unknown[]) => diaryClientFindMany(...args) },
        psychologistAddress: { findMany: (...args: unknown[]) => addressFindMany(...args) },
        psychologistSettings: { findUnique: (...args: unknown[]) => settingsFindUnique(...args) },
    },
}));

function jsonReq(body: unknown) {
    return { headers: { get: () => 'application/json' }, json: async () => body } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'psy-1' } });
    diaryClientFindMany.mockResolvedValue([]);
    addressFindMany.mockResolvedValue([]);
    settingsFindUnique.mockResolvedValue({ defaultSessionDuration: 50 });
});

describe('POST /api/diary/clients/import-spreadsheet/preview', () => {
    it('returns 401 without a session', async () => {
        auth.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'client_only', source: 'paste', text: 'Анна' }));
        expect(res.status).toBe(401);
    });

    it('rejects an unrecognized mode', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'bogus', source: 'paste', text: 'Анна' }));
        expect(res.status).toBe(400);
    });

    it('client_only + paste parses free-form lines without requiring a header', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'client_only', source: 'paste', text: 'Анна Иванова, +79161234567' }));
        const body = await res.json();
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0]).toMatchObject({ name: 'Анна Иванова', bucket: 'ready' });
    });

    it('spreadsheet + csv reports unused columns', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const csv = 'ФИО,Дата,Начало,Источник\nАнна Иванова,12.09.2026,15:00,excel';
        const res = await POST(jsonReq({ mode: 'spreadsheet', source: 'csv', text: csv }));
        const body = await res.json();
        expect(body.unusedHeaders).toEqual(['Источник']);
        expect(body.rows[0].date).toBe('2026-09-12');
    });

    it('spreadsheet mode returns NO_DATE_TIME_COLUMNS as HTTP 400 when columns cannot be identified', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'spreadsheet', source: 'csv', text: 'ФИО,Заметка\nАнна,test' }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('NO_DATE_TIME_COLUMNS');
    });

    it('caps processed rows and reports truncated:true beyond the row limit', async () => {
        const rows = Array.from({ length: 2001 }, (_, i) => `Клиент ${i}`).join('\n');
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'client_only', source: 'paste', text: rows }));
        const body = await res.json();
        expect(body.truncated).toBe(true);
        expect(body.rows).toHaveLength(2000);
    });

    it('rejects paste source under spreadsheet mode (paste requires a header -> use paste_table)', async () => {
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(jsonReq({ mode: 'spreadsheet', source: 'paste', text: 'anything' }));
        expect(res.status).toBe(400);
    });
});

async function buildXlsx(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    build(wb);
    return Buffer.from(await wb.xlsx.writeBuffer());
}

function multipartReq(fields: Record<string, string | Blob>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return { headers: { get: () => 'multipart/form-data; boundary=x' }, formData: async () => form } as any;
}

describe('POST .../preview — xlsx sheet selection', () => {
    it('asks for a sheet when the workbook has more than one non-empty sheet', async () => {
        const buffer = await buildXlsx((wb) => {
            wb.addWorksheet('A').addRow(['name']);
            wb.getWorksheet('A')!.addRow(['Анна']);
            wb.addWorksheet('B').addRow(['name']);
            wb.getWorksheet('B')!.addRow(['Иван']);
        });
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(multipartReq({ mode: 'client_only', source: 'xlsx', file: new Blob([new Uint8Array(buffer)]) }));
        const body = await res.json();
        expect(body.needsSheetSelection).toBe(true);
        expect(body.sheets.map((s: { name: string }) => s.name)).toEqual(['A', 'B']);
    });

    it('rejects an oversized file without reading it', async () => {
        const file = new File([new Uint8Array(10)], 'big.xlsx');
        Object.defineProperty(file, 'size', { value: 16 * 1024 * 1024 });
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(multipartReq({ mode: 'client_only', source: 'xlsx', file }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('FILE_TOO_LARGE');
    });

    it('reads the chosen sheet once sheetName is provided', async () => {
        const buffer = await buildXlsx((wb) => {
            wb.addWorksheet('A').addRow(['name']);
            wb.getWorksheet('A')!.addRow(['Анна']);
            wb.addWorksheet('B').addRow(['name']);
            wb.getWorksheet('B')!.addRow(['Иван Петров']);
        });
        const { POST } = await import('../src/app/api/diary/clients/import-spreadsheet/preview/route');
        const res = await POST(multipartReq({ mode: 'client_only', source: 'xlsx', sheetName: 'B', file: new Blob([new Uint8Array(buffer)]) }));
        const body = await res.json();
        expect(body.rows[0].name).toBe('Иван Петров');
    });
});
