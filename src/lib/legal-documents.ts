import type { LegalDocument } from '@prisma/client';
import { db } from '@/lib/db';

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
        url: '/legal/terms',
        publishedAt: new Date('2026-02-22T00:00:00.000Z'),
        required: true,
    },
    PRIVACY: {
        title: 'Политика конфиденциальности',
        version: '2026-02-22',
        url: '/legal/privacy',
        publishedAt: new Date('2026-02-22T00:00:00.000Z'),
        required: true,
    },
    ADS: {
        title: 'Согласие на рекламные сообщения',
        version: '2026-06-21',
        url: '/legal/ads',
        publishedAt: new Date('2026-06-21T00:00:00.000Z'),
        required: false,
    },
};

export function legalDocTitle(type: string) {
    return SYSTEM_LEGAL_DOCUMENTS[type as LegalDocType]?.title ?? type;
}

export function normalizeLegalDocUrl(url: string) {
    const lower = url.toLowerCase();
    if (lower.startsWith('http')) return url;
    return url.startsWith('/') ? url : `/${url}`;
}

async function ensureSystemLegalDocument(type: LegalDocType): Promise<LegalDocument> {
    const config = SYSTEM_LEGAL_DOCUMENTS[type];
    const active = await db.legalDocument.findFirst({
        where: { type, isActive: true },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (active) {
        const activeUrl = normalizeLegalDocUrl(active.url);
        if (activeUrl !== config.url || active.version === config.version) {
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
