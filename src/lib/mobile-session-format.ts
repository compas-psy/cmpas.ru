export function toMobileType(value: unknown) {
    if (value === 'couple') return 'COUPLE';
    if (value === 'family') return 'FAMILY';
    return 'INDIVIDUAL';
}

export function toDatabaseType(value: unknown) {
    if (value === 'COUPLE') return 'couple';
    if (value === 'FAMILY') return 'family';
    return 'individual';
}

export function normalizePaymentStatus(value: unknown) {
    const raw = String(value || 'not_required').toLowerCase();
    if (raw === 'paid') return 'PAID';
    if (raw === 'unpaid') return 'UNPAID';
    return 'NOT_REQUIRED';
}

export function toDatabasePaymentStatus(value: unknown) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'paid') return 'paid';
    if (raw === 'unpaid') return 'unpaid';
    if (raw === 'not_required') return 'not_required';
    return null;
}

const blockLabels: Record<string, string> = {
    request: 'Запрос',
    observation: 'Наблюдение',
    intervention: 'Интервенция',
    dynamics: 'Динамика',
    next_step: 'Следующий шаг',
    homework: 'Домашнее задание',
    resources: 'Ресурсы',
    anamnesis: 'Анамнез',
    quote: 'Цитата',
    hypothesis: 'Гипотеза',
    short_note: 'Кратко',
};

export function structuredNoteBlocks(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray((value as any).blocks)) return (value as any).blocks;
    return [];
}

export function normalizeStructuredNotesForStorage(value: unknown): { blocks: any[] } | null {
    const blocks = structuredNoteBlocks(value);
    return blocks.length ? { blocks } : null;
}

export function notesPlainFromStructured(value: unknown): string | null {
    const blocks = structuredNoteBlocks(value);
    if (!blocks.length) return null;
    const parts = blocks.flatMap((block: any) => {
        const label = blockLabels[block?.definitionId] || block?.definitionId || 'Заметка';
        const values = block?.values && typeof block.values === 'object' ? Object.values(block.values) : [];
        const text = values.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
        return text ? [`${label}:\n${text}`] : [];
    });
    return parts.length ? parts.join('\n\n') : null;
}

export function formatSession(s: any, onlineSessionLink: string | null = null) {
    const online = s.format !== 'in_person' && s.format !== 'offline';
    const blocks = structuredNoteBlocks(s.structuredNotes);
    const notesPlain = notesPlainFromStructured(s.structuredNotes) || (typeof s.clientSummary === 'string' ? s.clientSummary : null) || (typeof s.notes === 'string' ? s.notes : null);
    return {
        id: s.id,
        clientId: s.client?.id || s.clientId || '',
        clientName: s.client?.name || 'Без имени',
        date: s.date instanceof Date ? s.date.toISOString().split('T')[0] : s.date,
        startTime: s.time || '00:00',
        endTime: s.endTime || '',
        status: (s.status || 'PENDING').toUpperCase(),
        paymentStatus: normalizePaymentStatus(s.paymentStatus),
        format: online ? 'ONLINE' : 'IN_PERSON',
        type: toMobileType(s.type),
        videoLink: online ? (s.videoLink ?? onlineSessionLink) : null,
        notes: typeof s.notes === 'string' ? s.notes : notesPlain,
        notesPlain,
        structuredNotes: blocks.length ? blocks : null,
    };
}
