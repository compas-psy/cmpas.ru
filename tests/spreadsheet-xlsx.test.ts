// Task 13 §3/§22: XLSX reading — real scalar/date/time cell values, never
// executing formulas; multiple non-empty sheets require explicit selection.
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { listXlsxSheets, readXlsxSheet } from '../src/lib/practice/migration/spreadsheet/xlsx';

async function buildWorkbook(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    build(wb);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}

describe('readXlsxSheet', () => {
    it('reads scalar string/number cells and a header row', async () => {
        const buffer = await buildWorkbook((wb) => {
            const sheet = wb.addWorksheet('Sheet1');
            sheet.addRow(['name', 'duration']);
            sheet.addRow(['Анна Иванова', 50]);
        });
        const table = await readXlsxSheet(buffer);
        expect(table.headers).toEqual(['name', 'duration']);
        expect(table.rows).toEqual([['Анна Иванова', 50]]);
    });

    it('reads a real Excel date cell as a Date, not a serial number', async () => {
        const buffer = await buildWorkbook((wb) => {
            const sheet = wb.addWorksheet('Sheet1');
            sheet.addRow(['date']);
            const row = sheet.addRow([new Date(Date.UTC(2026, 8, 12))]);
            row.getCell(1).numFmt = 'yyyy-mm-dd';
        });
        const table = await readXlsxSheet(buffer);
        expect(table.rows[0][0]).toBeInstanceOf(Date);
        const d = table.rows[0][0] as Date;
        expect(d.getUTCFullYear()).toBe(2026);
        expect(d.getUTCMonth()).toBe(8);
        expect(d.getUTCDate()).toBe(12);
    });

    it('reads a real Excel time-of-day cell', async () => {
        const buffer = await buildWorkbook((wb) => {
            const sheet = wb.addWorksheet('Sheet1');
            sheet.addRow(['start_time']);
            // Excel time-of-day serial: fraction of a day since epoch 1899-12-30.
            const row = sheet.addRow([new Date(Date.UTC(1899, 11, 30, 15, 0, 0))]);
            row.getCell(1).numFmt = 'hh:mm';
        });
        const table = await readXlsxSheet(buffer);
        const d = table.rows[0][0] as Date;
        expect(d.getUTCHours()).toBe(15);
        expect(d.getUTCMinutes()).toBe(0);
    });

    it('uses a formula cell\'s cached result, never re-executing the formula', async () => {
        const buffer = await buildWorkbook((wb) => {
            const sheet = wb.addWorksheet('Sheet1');
            sheet.addRow(['total']);
            sheet.addRow([{ formula: '1+1', result: 2 }]);
        });
        const table = await readXlsxSheet(buffer);
        expect(table.rows[0][0]).toBe(2);
    });

    it('drops fully blank rows', async () => {
        const buffer = await buildWorkbook((wb) => {
            const sheet = wb.addWorksheet('Sheet1');
            sheet.addRow(['name']);
            sheet.addRow(['Анна']);
            sheet.addRow([]);
            sheet.addRow(['Михаил']);
        });
        const table = await readXlsxSheet(buffer);
        expect(table.rows).toEqual([['Анна'], ['Михаил']]);
    });

    it('reads the named sheet when multiple sheets exist', async () => {
        const buffer = await buildWorkbook((wb) => {
            wb.addWorksheet('First').addRow(['a']);
            wb.getWorksheet('First')!.addRow(['1']);
            wb.addWorksheet('Second').addRow(['b']);
            wb.getWorksheet('Second')!.addRow(['2']);
        });
        const table = await readXlsxSheet(buffer, 'Second');
        expect(table.headers).toEqual(['b']);
        expect(table.rows).toEqual([['2']]);
    });
});

describe('listXlsxSheets / sheet selection requirement', () => {
    it('reports every non-empty sheet with its row count', async () => {
        const buffer = await buildWorkbook((wb) => {
            const s1 = wb.addWorksheet('Clients');
            s1.addRow(['name']);
            s1.addRow(['Анна']);
            const s2 = wb.addWorksheet('Sessions');
            s2.addRow(['name', 'date']);
            s2.addRow(['Анна', '2026-09-12']);
            s2.addRow(['Михаил', '2026-09-13']);
        });
        const sheets = await listXlsxSheets(buffer);
        expect(sheets).toEqual([
            { name: 'Clients', rowCount: 2 },
            { name: 'Sessions', rowCount: 3 },
        ]);
    });

    it('excludes an entirely empty sheet from the non-empty list', async () => {
        const buffer = await buildWorkbook((wb) => {
            const s1 = wb.addWorksheet('Data');
            s1.addRow(['name']);
            s1.addRow(['Анна']);
            wb.addWorksheet('EmptySheet');
        });
        const sheets = await listXlsxSheets(buffer);
        expect(sheets.map((s) => s.name)).toEqual(['Data']);
    });

    it('readXlsxSheet without a sheet name throws when more than one sheet is non-empty — never silently picks one', async () => {
        const buffer = await buildWorkbook((wb) => {
            wb.addWorksheet('A').addRow(['x']);
            wb.addWorksheet('B').addRow(['y']);
        });
        await expect(readXlsxSheet(buffer)).rejects.toThrow('SHEET_SELECTION_REQUIRED');
    });

    it('readXlsxSheet without a sheet name succeeds when only one sheet is non-empty', async () => {
        const buffer = await buildWorkbook((wb) => {
            const s1 = wb.addWorksheet('Data');
            s1.addRow(['name']);
            s1.addRow(['Анна']);
            wb.addWorksheet('Empty');
        });
        const table = await readXlsxSheet(buffer);
        expect(table.headers).toEqual(['name']);
    });
});
