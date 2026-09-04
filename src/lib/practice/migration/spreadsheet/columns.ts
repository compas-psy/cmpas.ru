// Task 13: canonical column resolution for CSV/XLSX/tabular-paste headers.
// Header matching is alias-based, trim + case-insensitive — column ORDER is
// never meaningful when headers exist (section 4/5 of the spec). Any header
// that doesn't map to a known canonical field is reported back as "unused"
// so the caller can tell the psychologist exactly what was ignored — no
// silent data loss.

export type ClientColumnKey = 'name' | 'phone' | 'email';
export type SessionColumnKey = ClientColumnKey | 'date' | 'start_time' | 'end_time' | 'duration' | 'format' | 'address';

export const CLIENT_COLUMN_ALIASES: Record<ClientColumnKey, string[]> = {
    name: ['name', 'client', 'client name', 'имя', 'клиент', 'фио', 'ф.и.о.'],
    phone: ['phone', 'mobile', 'telephone', 'телефон', 'мобильный'],
    email: ['email', 'e-mail', 'mail', 'почта'],
};

export const SESSION_COLUMN_ALIASES: Record<SessionColumnKey, string[]> = {
    ...CLIENT_COLUMN_ALIASES,
    date: ['date', 'дата'],
    start_time: ['start', 'start time', 'time', 'начало', 'время', 'время начала'],
    end_time: ['end', 'end time', 'окончание', 'время окончания'],
    duration: ['duration', 'duration min', 'minutes', 'длительность', 'минут'],
    format: ['format', 'формат'],
    address: ['address', 'location', 'cabinet', 'адрес', 'кабинет', 'место'],
};

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export interface ColumnResolution<K extends string> {
    /** Canonical field -> column index in the header row. */
    mapping: Partial<Record<K, number>>;
    /** Original header text of every column that matched no canonical field. */
    unusedHeaders: string[];
}

export function resolveColumns<K extends string>(headers: string[], aliasMap: Record<K, string[]>): ColumnResolution<K> {
    const normalizedHeaders = headers.map(normalizeHeader);
    const mapping: Partial<Record<K, number>> = {};
    const usedIdx = new Set<number>();

    for (const key of Object.keys(aliasMap) as K[]) {
        const aliases = aliasMap[key].map(normalizeHeader);
        const idx = normalizedHeaders.findIndex((h, i) => !usedIdx.has(i) && aliases.includes(h));
        if (idx !== -1) {
            mapping[key] = idx;
            usedIdx.add(idx);
        }
    }

    const unusedHeaders = headers.filter((_, i) => !usedIdx.has(i) && headers[i].trim() !== '');
    return { mapping, unusedHeaders };
}

export function cellAt(row: unknown[], mapping: Partial<Record<string, number>>, key: string): unknown {
    const idx = mapping[key];
    if (idx === undefined) return null;
    return row[idx] ?? null;
}
