// Task 13: XLSX reading via exceljs. Only scalar/date cell VALUES are ever
// read — a formula cell's cached `.result` is used, the formula itself is
// never evaluated/executed. If a workbook has more than one non-empty sheet,
// the caller must ask the psychologist which one to use (listXlsxSheets) —
// this module never silently picks one.
import ExcelJS from 'exceljs';

export interface XlsxSheetInfo {
    name: string;
    rowCount: number;
}

export type XlsxCellValue = string | number | Date | null;

export interface XlsxTable {
    headers: string[];
    rows: XlsxCellValue[][];
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    return wb;
}

function normalizeCellValue(v: ExcelJS.CellValue): XlsxCellValue {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
        const obj = v as unknown as Record<string, unknown>;
        // Formula cell: use the cached result, never the formula itself.
        if ('result' in obj) return normalizeCellValue(obj.result as ExcelJS.CellValue);
        if ('richText' in obj && Array.isArray(obj.richText)) {
            return (obj.richText as { text: string }[]).map((t) => t.text).join('');
        }
        if ('text' in obj) return String(obj.text);
        if ('error' in obj) return null;
        return null;
    }
    return v as string | number;
}

function nonEmptySheets(wb: ExcelJS.Workbook): { sheet: ExcelJS.Worksheet; rowCount: number }[] {
    const result: { sheet: ExcelJS.Worksheet; rowCount: number }[] = [];
    wb.eachSheet((sheet) => {
        let rowCount = 0;
        sheet.eachRow({ includeEmpty: false }, (row) => {
            const raw = row.values as ExcelJS.CellValue[];
            const hasContent = Array.isArray(raw) && raw.slice(1).some((v) => normalizeCellValue(v) !== null && String(normalizeCellValue(v)).trim() !== '');
            if (hasContent) rowCount++;
        });
        if (rowCount > 0) result.push({ sheet, rowCount });
    });
    return result;
}

export async function listXlsxSheets(buffer: Buffer): Promise<XlsxSheetInfo[]> {
    const wb = await loadWorkbook(buffer);
    return nonEmptySheets(wb).map(({ sheet, rowCount }) => ({ name: sheet.name, rowCount }));
}

/**
 * Reads one sheet's scalar rows. When `sheetName` is omitted, the workbook
 * must have exactly one non-empty sheet (caller's responsibility to check
 * via listXlsxSheets first and prompt for a selection otherwise) — this
 * throws SHEET_SELECTION_REQUIRED rather than guessing.
 */
export async function readXlsxSheet(buffer: Buffer, sheetName?: string): Promise<XlsxTable> {
    const wb = await loadWorkbook(buffer);
    const candidates = nonEmptySheets(wb);

    let sheet: ExcelJS.Worksheet | undefined;
    if (sheetName) {
        sheet = wb.getWorksheet(sheetName);
        if (!sheet) throw new Error('SHEET_NOT_FOUND');
    } else {
        if (candidates.length > 1) throw new Error('SHEET_SELECTION_REQUIRED');
        sheet = candidates[0]?.sheet;
        if (!sheet) throw new Error('SHEET_NOT_FOUND');
    }

    const rows: XlsxCellValue[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
        const raw = row.values as ExcelJS.CellValue[];
        const values = raw.slice(1).map((v) => normalizeCellValue(v));
        if (values.some((v) => v !== null && String(v).trim() !== '')) rows.push(values);
    });

    const [headerRow, ...dataRows] = rows;
    return {
        headers: (headerRow ?? []).map((v) => (v === null ? '' : String(v).trim())),
        rows: dataRows,
    };
}
