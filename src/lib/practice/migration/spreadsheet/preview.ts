// Task 13: preview orchestration — parse -> normalize -> validate ->
// matchClientIdentity -> bucket. Pure functions (no DB access themselves);
// the API route fetches existingClients/addresses and passes them in. Rows
// never silently disappear: every input row produces exactly one preview
// row with a bucket (ready/review/skipped/error) and, if applicable, a
// stable error code from the spec's vocabulary.
import { parseClientLines } from '@/lib/clients/parse';
import { matchClientIdentity, type ClientIdentity, type MatchReason } from '@/lib/clients/match';
import { computeClientKey } from '@/lib/clients/identity-key';
import { resolveColumns, CLIENT_COLUMN_ALIASES, SESSION_COLUMN_ALIASES, type SessionColumnKey } from './columns';
import { parseCellDate, parseCellTime, resolveDuration, normalizeFormat, cellToTrimmedString, type CellRaw } from './row-parse';
import { matchAddress, type AddressRow } from './match-address';
import { computeSourceFingerprint } from './fingerprint';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOf(v: string): string {
    return v.replace(/\D/g, '');
}

export type PreviewBucket = 'ready' | 'review' | 'skipped' | 'error';

export interface PreviewContext {
    existingClients: ClientIdentity[];
    addresses: AddressRow[];
    defaultDuration: number;
}

export interface ClientOnlyPreviewRow {
    rowIndex: number;
    mode: 'client_only';
    name: string | null;
    phone: string | null;
    email: string | null;
    matchReason: MatchReason;
    resolvedClientId: string | null;
    suggestedClientId: string | null;
    errorCode?: string;
    bucket: PreviewBucket;
}

export interface SessionPreviewRow {
    rowIndex: number;
    mode: 'spreadsheet';
    name: string | null;
    phone: string | null;
    email: string | null;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    duration: number | null;
    format: 'online' | 'offline';
    addressRaw: string | null;
    addressId: string | null;
    matchReason: MatchReason;
    resolvedClientId: string | null;
    suggestedClientId: string | null;
    sourceFingerprint: string | null;
    errorCode?: string;
    bucket: PreviewBucket;
}

function classifyClientMatch(match: ReturnType<typeof matchClientIdentity>): { bucket: PreviewBucket; errorCode?: string } {
    if (match.resolvedClientId) return { bucket: 'ready' };
    if (match.matchReason === 'conflict') return { bucket: 'review', errorCode: 'CLIENT_IDENTITY_CONFLICT' };
    if (match.matchReason === 'name_only') return { bucket: 'review', errorCode: 'NAME_ONLY_COLLISION' };
    return { bucket: 'ready' }; // no match at all -> a genuine new client, per §11
}

/** §9/§11: free-form "one line = one client" paste. Reuses the existing line parser's semantics unchanged. Progressively grows the match pool with each row's own decision so within-upload strong-identity repeats collapse and bare-name repeats go to review — never silently merged (§12). */
export function buildClientOnlyPreviewFromLines(text: string, ctx: PreviewContext): ClientOnlyPreviewRow[] {
    const parsed = parseClientLines(text);
    const pool: ClientIdentity[] = [...ctx.existingClients];
    const rows: ClientOnlyPreviewRow[] = [];

    parsed.forEach((p, i) => {
        if (!p.valid) {
            rows.push({
                rowIndex: i, mode: 'client_only', name: null, phone: p.phone ?? null, email: p.email ?? null,
                matchReason: 'none', resolvedClientId: null, suggestedClientId: null, errorCode: 'MISSING_NAME', bucket: 'error',
            });
            return;
        }
        const match = matchClientIdentity({ name: p.name, phone: p.phone, email: p.email }, pool);
        const row = buildClientOnlyRow(i, p.name, p.phone ?? null, p.email ?? null, match);
        rows.push(row);
        // A strong match to a PRE-EXISTING db client is "already exists" —
        // never treated as if it were about to be freshly created (§11).
        const isNewClient = row.bucket === 'ready' && match.matchReason === 'none';
        if (isNewClient) pool.push({ id: `pending-row-${i}`, name: p.name, phone: p.phone ?? null, email: p.email ?? null });
    });
    return rows;
}

function buildClientOnlyRow(rowIndex: number, name: string, phone: string | null, email: string | null, match: ReturnType<typeof matchClientIdentity>): ClientOnlyPreviewRow {
    const { bucket, errorCode } = classifyClientMatch(match);
    // §11: a strong match means this client already exists — the row is a
    // safe no-op skip, never presented as "ready to create."
    if (match.resolvedClientId) {
        return {
            rowIndex, mode: 'client_only', name, phone, email,
            matchReason: match.matchReason, resolvedClientId: match.resolvedClientId, suggestedClientId: match.suggestedClientId,
            errorCode: 'ALREADY_EXISTS', bucket: 'skipped',
        };
    }
    return {
        rowIndex, mode: 'client_only', name, phone, email,
        matchReason: match.matchReason, resolvedClientId: null, suggestedClientId: match.suggestedClientId,
        errorCode, bucket,
    };
}

interface RawClientFields {
    name: string;
    phone: string | null;
    email: string | null;
    nameError?: string;
    phoneError?: string;
    emailError?: string;
}

function extractClientFields(row: CellRaw[], mapping: Partial<Record<string, number>>): RawClientFields {
    const nameRaw = cellToTrimmedString(mapping.name !== undefined ? row[mapping.name] : null);
    const phoneRaw = cellToTrimmedString(mapping.phone !== undefined ? row[mapping.phone] : null);
    const emailRaw = cellToTrimmedString(mapping.email !== undefined ? row[mapping.email] : null);

    const result: RawClientFields = { name: nameRaw, phone: null, email: null };
    if (!nameRaw || nameRaw.length < 2) result.nameError = 'MISSING_NAME';

    if (phoneRaw) {
        const digits = digitsOf(phoneRaw);
        if (digits.length < 7 || digits.length > 15) result.phoneError = 'INVALID_PHONE';
        else result.phone = phoneRaw;
    }
    if (emailRaw) {
        if (!EMAIL_RE.test(emailRaw)) result.emailError = 'INVALID_EMAIL';
        else result.email = emailRaw.toLowerCase();
    }
    return result;
}

/** §4/§5: CSV/XLSX/tabular-paste rows for client-only mode. Column order is never meaningful — resolveColumns already did the alias mapping. */
export function buildClientOnlyPreviewFromTable(headers: string[], dataRows: CellRaw[][], ctx: PreviewContext): { rows: ClientOnlyPreviewRow[]; unusedHeaders: string[] } {
    const { mapping, unusedHeaders } = resolveColumns(headers, CLIENT_COLUMN_ALIASES);
    const pool: ClientIdentity[] = [...ctx.existingClients];
    const rows: ClientOnlyPreviewRow[] = [];

    dataRows.forEach((raw, i) => {
        const fields = extractClientFields(raw, mapping);
        if (fields.nameError) {
            rows.push({ rowIndex: i, mode: 'client_only', name: null, phone: fields.phone, email: fields.email, matchReason: 'none', resolvedClientId: null, suggestedClientId: null, errorCode: fields.nameError, bucket: 'error' });
            return;
        }
        if (fields.phoneError || fields.emailError) {
            rows.push({ rowIndex: i, mode: 'client_only', name: fields.name, phone: fields.phone, email: fields.email, matchReason: 'none', resolvedClientId: null, suggestedClientId: null, errorCode: fields.phoneError ?? fields.emailError, bucket: 'error' });
            return;
        }
        const match = matchClientIdentity({ name: fields.name, phone: fields.phone, email: fields.email }, pool);
        const row = buildClientOnlyRow(i, fields.name, fields.phone, fields.email, match);
        rows.push(row);
        const isNewClient = row.bucket === 'ready' && match.matchReason === 'none';
        if (isNewClient) pool.push({ id: `pending-row-${i}`, name: fields.name, phone: fields.phone, email: fields.email });
    });

    return { rows, unusedHeaders };
}

/** §5/§10: CSV/XLSX/tabular-paste rows for "clients + sessions" mode. */
export function buildSessionPreviewFromTable(headers: string[], dataRows: CellRaw[][], ctx: PreviewContext): { rows: SessionPreviewRow[]; unusedHeaders: string[] } | { errorCode: 'NO_DATE_TIME_COLUMNS' } {
    const { mapping, unusedHeaders } = resolveColumns<SessionColumnKey>(headers, SESSION_COLUMN_ALIASES);
    if (mapping.date === undefined || mapping.start_time === undefined) {
        return { errorCode: 'NO_DATE_TIME_COLUMNS' };
    }

    const pool: ClientIdentity[] = [...ctx.existingClients];
    const seenFingerprints = new Set<string>();
    const rows: SessionPreviewRow[] = [];

    dataRows.forEach((raw, i) => {
        const clientFields = extractClientFields(raw, mapping);
        const dateRaw = mapping.date !== undefined ? raw[mapping.date] : null;
        const startRaw = mapping.start_time !== undefined ? raw[mapping.start_time] : null;
        const endRaw = mapping.end_time !== undefined ? raw[mapping.end_time] : null;
        const durationRaw = mapping.duration !== undefined ? raw[mapping.duration] : null;
        const formatRaw = mapping.format !== undefined ? raw[mapping.format] : null;
        const addressRaw = mapping.address !== undefined ? cellToTrimmedString(raw[mapping.address]) : '';

        const base = {
            rowIndex: i, mode: 'spreadsheet' as const,
            name: clientFields.name || null, phone: clientFields.phone, email: clientFields.email,
            date: null, startTime: null, endTime: null, duration: null,
            format: normalizeFormat(formatRaw), addressRaw: addressRaw || null, addressId: null,
            matchReason: 'none' as MatchReason, resolvedClientId: null, suggestedClientId: null, sourceFingerprint: null,
        };

        if (clientFields.nameError) {
            rows.push({ ...base, errorCode: clientFields.nameError, bucket: 'error' });
            return;
        }
        if (clientFields.phoneError || clientFields.emailError) {
            rows.push({ ...base, errorCode: clientFields.phoneError ?? clientFields.emailError, bucket: 'error' });
            return;
        }

        const dateResult = parseCellDate(dateRaw);
        const timeResult = parseCellTime(startRaw);
        if (!dateResult.ok || !timeResult.ok) {
            rows.push({ ...base, errorCode: 'INVALID_DATE_OR_TIME', bucket: 'error' });
            return;
        }

        const durationResult = resolveDuration({ durationRaw: durationRaw as CellRaw, startTime: timeResult.time, endTimeRaw: endRaw as CellRaw, defaultDuration: ctx.defaultDuration });
        if (!durationResult.ok) {
            rows.push({ ...base, date: dateResult.date, startTime: timeResult.time, errorCode: durationResult.errorCode, bucket: 'error' });
            return;
        }

        let endTime: string | null = null;
        if (endRaw !== null && endRaw !== undefined && cellToTrimmedString(endRaw) !== '') {
            const endParsed = parseCellTime(endRaw);
            if (endParsed.ok) endTime = endParsed.time;
        }

        let addressId: string | null = null;
        let addressErrorCode: string | undefined;
        if (base.format === 'offline') {
            if (!addressRaw) {
                addressErrorCode = 'ADDRESS_REQUIRED';
            } else {
                const addrMatch = matchAddress(addressRaw, ctx.addresses);
                if (addrMatch.ok) addressId = addrMatch.addressId;
                else addressErrorCode = addrMatch.errorCode;
            }
        }

        const clientKey = computeClientKey({ phone: clientFields.phone, email: clientFields.email, name: clientFields.name });
        const fingerprint = computeSourceFingerprint({
            clientKey, date: dateResult.date, startTime: timeResult.time, duration: durationResult.duration,
            format: base.format, addressKey: addressId ?? addressRaw,
        });

        if (seenFingerprints.has(fingerprint)) {
            rows.push({
                ...base, date: dateResult.date, startTime: timeResult.time, endTime, duration: durationResult.duration,
                addressId, sourceFingerprint: fingerprint, errorCode: 'DUPLICATE_SOURCE_ROW', bucket: 'skipped',
            });
            return;
        }

        const match = matchClientIdentity({ name: clientFields.name, phone: clientFields.phone, email: clientFields.email }, pool);
        const clientClass = classifyClientMatch(match);

        let bucket: PreviewBucket = clientClass.bucket;
        const errorCode: string | undefined = clientClass.errorCode ?? addressErrorCode;
        if (addressErrorCode) bucket = 'review';

        if (bucket === 'ready') seenFingerprints.add(fingerprint);
        const isNewClient = bucket === 'ready' && match.matchReason === 'none';
        if (isNewClient) pool.push({ id: `pending-row-${i}`, name: clientFields.name, phone: clientFields.phone, email: clientFields.email });

        rows.push({
            ...base,
            date: dateResult.date, startTime: timeResult.time, endTime, duration: durationResult.duration,
            addressId, matchReason: match.matchReason, resolvedClientId: match.resolvedClientId, suggestedClientId: match.suggestedClientId,
            sourceFingerprint: fingerprint, errorCode, bucket,
        });
    });

    return { rows, unusedHeaders };
}
