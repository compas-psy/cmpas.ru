import type { LegalDocument } from '@prisma/client';
import { db } from '@/lib/db';

const PUBLIC_ORIGIN = 'https://cmpas.ru';

export const LEGAL_DOC_TYPES = ['TERMS', 'PRIVACY', 'ADS'] as const;
export type LegalDocType = typeof LEGAL_DOC_TYPES[number];

export const REQUIRED_LEGAL_DOC_TYPES: LegalDocType[] = ['TERMS', 'PRIVACY'];

export const SYSTEM_LEGAL_DOCUMENTS: Record<LegalDocType, {
    title: string;
    version: string;
    url: string;
    publishedAt: Date;
    required: boolean;
}> = {
    TERMS: {
        title: 'Пользовательское соглашение',
        version: '2026-02-22',
        url: '/diary/legal/terms',
        publishedAt: new Date('2026-02-22T00:00:00.000Z'),
        required: true,
    },
    PRIVACY: {
        title: 'Политика конфиденциальности',
        version: '2026-02-22',
        url: '/diary/legal/privacy',
        publishedAt: new Date('2026-02-22T00:00:00.000Z'),
        required: true,
    },
    ADS: {
        title: 'Согласие на получение рекламных сообщений',
        version: '2025-09-01',
        url: '/legal/consent/marketing',
        publishedAt: new Date('2025-09-01T00:00:00.000Z'),
        required: false,
    },
};

export function legalDocTitle(type: string) {
    return SYSTEM_LEGAL_DOCUMENTS[type as LegalDocType]?.title ?? type;
}

export function normalizeLegalDocUrl(url: string) {
    const value = url.trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
        const parsed = new URL(value);
        return parsed.hostname === 'cmpas.ru' ? parsed.pathname : value;
    }
    if (lower.startsWith('cmpas.ru/')) return value.substring('cmpas.ru'.length);
    return value.startsWith('/') ? value : `/${value}`;
}

export function publicLegalDocUrl(url: string) {
    const value = url.trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) return value;
    if (lower.startsWith('cmpas.ru/')) return `https://${value}`;
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${PUBLIC_ORIGIN}${path}`;
}

async function ensureSystemLegalDocument(type: LegalDocType): Promise<LegalDocument> {
    const config = SYSTEM_LEGAL_DOCUMENTS[type];
    const active = await db.legalDocument.findFirst({
        where: { type, isActive: true },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (active) {
        const activeUrl = normalizeLegalDocUrl(active.url);
        if (activeUrl === config.url && active.version === config.version) {
            return active;
        }
        await db.legalDocument.update({ where: { id: active.id }, data: { isActive: false } });
    }

    const existingSystemDoc = await db.legalDocument.findFirst({
        where: { type, version: config.version, url: config.url },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (existingSystemDoc) {
        if (!existingSystemDoc.isActive) {
            await db.legalDocument.updateMany({ where: { type }, data: { isActive: false } });
            return db.legalDocument.update({ where: { id: existingSystemDoc.id }, data: { isActive: true } });
        }
        return existingSystemDoc;
    }

    await db.legalDocument.updateMany({ where: { type }, data: { isActive: false } });
    return db.legalDocument.create({
        data: {
            type,
            version: config.version,
            url: config.url,
            isActive: true,
            publishedAt: config.publishedAt,
        },
    });
}

export async function ensureActiveLegalDocuments(types: readonly LegalDocType[] = LEGAL_DOC_TYPES) {
    const documents: LegalDocument[] = [];
    for (const type of types) {
        documents.push(await ensureSystemLegalDocument(type));
    }
    return documents;
}

export async function getActiveLegalDocuments(types: readonly LegalDocType[] = LEGAL_DOC_TYPES) {
    await ensureActiveLegalDocuments(types);
    return db.legalDocument.findMany({
        where: { isActive: true, type: { in: [...types] } },
        orderBy: [{ type: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
}

export async function getActiveLegalDocument(type: LegalDocType) {
    const [doc] = await getActiveLegalDocuments([type]);
    return doc ?? null;
}
