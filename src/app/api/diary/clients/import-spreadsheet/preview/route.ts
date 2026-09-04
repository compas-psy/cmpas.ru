import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { parseDelimitedTable } from '@/lib/practice/migration/spreadsheet/csv';
import { listXlsxSheets, readXlsxSheet } from '@/lib/practice/migration/spreadsheet/xlsx';
import { buildClientOnlyPreviewFromLines, buildClientOnlyPreviewFromTable, buildSessionPreviewFromTable, type PreviewContext } from '@/lib/practice/migration/spreadsheet/preview';

// Task 13: preview — parse (csv/xlsx/paste) -> normalize -> match -> bucket.
// Never mutates anything; commit only happens through apply -> commitPracticeImport.
const MAX_FILE_SIZE = 15 * 1024 * 1024; // same cap as /api/diary/documents/upload
const MAX_ROWS = 2000;

export async function POST(req: NextRequest) {
    const session = await auth();
    const psychologistId = session?.user?.id;
    if (!psychologistId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const contentType = req.headers.get('content-type') || '';
        let mode: string;
        let source: string;
        let text = '';
        let sheetName: string | undefined;
        let xlsxBuffer: Buffer | null = null;

        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            mode = String(form.get('mode') || '');
            source = String(form.get('source') || 'xlsx');
            sheetName = form.get('sheetName') ? String(form.get('sheetName')) : undefined;
            const file = form.get('file');
            if (!(file instanceof File)) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
            if (file.size <= 0) return NextResponse.json({ error: 'FILE_EMPTY' }, { status: 400 });
            if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 });
            xlsxBuffer = Buffer.from(await file.arrayBuffer());
        } else {
            const body = await req.json();
            mode = String(body.mode || '');
            source = String(body.source || 'paste');
            text = typeof body.text === 'string' ? body.text : '';
            sheetName = typeof body.sheetName === 'string' ? body.sheetName : undefined;
        }

        if (mode !== 'client_only' && mode !== 'spreadsheet') {
            return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 });
        }

        let headers: string[] = [];
        let dataRows: (string | number | Date | null)[][] = [];

        if (source === 'xlsx') {
            if (!xlsxBuffer) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
            if (!sheetName) {
                const sheets = await listXlsxSheets(xlsxBuffer);
                if (sheets.length > 1) return NextResponse.json({ needsSheetSelection: true, sheets });
            }
            const table = await readXlsxSheet(xlsxBuffer, sheetName);
            headers = table.headers;
            dataRows = table.rows;
        } else if (source === 'csv' || source === 'paste_table') {
            const table = parseDelimitedTable(text);
            headers = table.headers;
            dataRows = table.rows;
        } else if (source === 'paste') {
            // Free-form "one line = one client" — client-only mode only (§9).
            if (mode !== 'client_only') return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 });
        } else {
            return NextResponse.json({ error: 'INVALID_SOURCE' }, { status: 400 });
        }

        const truncated = dataRows.length > MAX_ROWS;
        if (truncated) dataRows = dataRows.slice(0, MAX_ROWS);

        const [existingClients, addresses, settings] = await Promise.all([
            db.diaryClient.findMany({ where: { psychologistId }, select: { id: true, name: true, phone: true, email: true } }),
            db.psychologistAddress.findMany({ where: { psychologistId }, select: { id: true, name: true, address: true } }),
            db.psychologistSettings.findUnique({ where: { psychologistId }, select: { defaultSessionDuration: true } }),
        ]);
        const ctx: PreviewContext = { existingClients, addresses, defaultDuration: settings?.defaultSessionDuration ?? 50 };

        if (mode === 'client_only') {
            if (source === 'paste') {
                const lines = text.split(/\r?\n/);
                const pasteTruncated = lines.length > MAX_ROWS;
                const limitedText = pasteTruncated ? lines.slice(0, MAX_ROWS).join('\n') : text;
                return NextResponse.json({ rows: buildClientOnlyPreviewFromLines(limitedText, ctx), unusedHeaders: [], truncated: pasteTruncated });
            }
            const { rows, unusedHeaders } = buildClientOnlyPreviewFromTable(headers, dataRows, ctx);
            return NextResponse.json({ rows, unusedHeaders, truncated });
        }

        const result = buildSessionPreviewFromTable(headers, dataRows, ctx);
        if ('errorCode' in result) return NextResponse.json({ error: result.errorCode }, { status: 400 });
        return NextResponse.json({ rows: result.rows, unusedHeaders: result.unusedHeaders, truncated });
    } catch (error) {
        if (error instanceof Error && (error.message === 'SHEET_NOT_FOUND' || error.message === 'SHEET_SELECTION_REQUIRED')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('[import-spreadsheet/preview POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
