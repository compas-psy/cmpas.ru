import type { LegalDocument } from '@prisma/client';
import { db } from '@/lib/db';

const PUBLIC_ORIGIN = 'https://cmpas.ru';

export const LEGAL_DOC_TYPES = ['TERMS', 'PRIVACY', 'ADS', 'PROFESSIONAL', 'PRACTICE'] as const;
export type LegalDocType = typeof LEGAL_DOC_TYPES[number];

// Canonical document codes — the identifier new logic should key off (per
// docs/03_LEGAL/CMPAS_LEGAL_IMPLEMENTATION.md). `type` above stays only for
// existing admin filtering/grouping.
export const LEGAL_CODES: Record<LegalDocType, string> = {
    TERMS: 'cmpas_terms',
    PRIVACY: 'cmpas_privacy',
    ADS: 'cmpas_marketing_consent',
    PROFESSIONAL: 'cmpas_professional',
    PRACTICE: 'cmpas_practice_terms',
};

// Legal architecture (founder-mandated, Task 4):
// - Privacy Policy is informational — it is NEVER an acceptance requirement.
// - Terms is required for every account.
// - Professional Agreement and Practice Terms are each their own, separately
//   required acceptance — not folded into Terms.
// - Marketing consent (ADS) is opt-in, never required, and its
//   revocation/immutable-evidence handling is Task 5 — untouched here.
export const ACCOUNT_REQUIRED_TYPES: LegalDocType[] = ['TERMS'];
export const PROFESSIONAL_REQUIRED_TYPES: LegalDocType[] = ['PROFESSIONAL'];
export const PRACTICE_REQUIRED_TYPES: LegalDocType[] = ['PRACTICE'];
export const INFORMATIONAL_ONLY_TYPES: LegalDocType[] = ['PRIVACY'];

// PROFESSIONAL/PRACTICE have no active entry below on purpose: no real legal
// text for them exists yet, and nothing here may fabricate it. Because
// getActiveLegalDocument() returns null for a type with no config,
// requiring PROFESSIONAL/PRACTICE resolves to "no active document" and is a
// safe no-op today — flip on the instant real text is supplied, with zero
// code changes required elsewhere.
export const SYSTEM_LEGAL_DOCUMENTS: Partial<Record<LegalDocType, {
    title: string;
    version: string;
    url: string;
    publishedAt: Date;
    required: boolean;
}>> = {
    TERMS: { title: 'Пользовательское соглашение', version: '2026-02-22', url: '/diary/legal/terms', publishedAt: new Date('2026-02-22T00:00:00.000Z'), required: true },
    PRIVACY: { title: 'Политика конфиденциальности', version: '2026-02-22', url: '/diary/legal/privacy', publishedAt: new Date('2026-02-22T00:00:00.000Z'), required: false },
    ADS: { title: 'Согласие на получение рекламных сообщений', version: '2.0', url: '/legal/consent/marketing', publishedAt: new Date('2025-09-01T00:00:00.000Z'), required: false },
};

const FALLBACK_TITLES: Partial<Record<LegalDocType, string>> = {
    PROFESSIONAL: 'Профессиональное соглашение',
    PRACTICE: 'Условия практики',
};

export function legalDocTitle(type: string) {
    return SYSTEM_LEGAL_DOCUMENTS[type as LegalDocType]?.title ?? FALLBACK_TITLES[type as LegalDocType] ?? type;
}

export function normalizeLegalDocUrl(url: string) {
    const value = url.trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('http')) {
        const parsed = new URL(value);
        return parsed.hostname === 'cmpas.ru' ? parsed.pathname : value;
    }
    if (lower.startsWith('cmpas.ru/')) return value.substring('cmpas.ru'.length);
    return value.startsWith('/') ? value : `/${value}`;
}

export function publicLegalDocUrl(url: string) {
    const value = url.trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('http')) return value;
    if (lower.startsWith('cmpas.ru/')) return `https://${value}`;
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${PUBLIC_ORIGIN}${path}`;
}

async function ensureSystemLegalDocument(type: LegalDocType): Promise<LegalDocument | null> {
    const config = SYSTEM_LEGAL_DOCUMENTS[type];
    if (!config) return null; // no real legal text for this type yet — never fabricate one

    const code = LEGAL_CODES[type];
    const active = await db.legalDocument.findFirst({ where: { type, isActive: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] });

    if (active) {
        const activeUrl = normalizeLegalDocUrl(active.url);
        if (activeUrl === config.url && active.version === config.version) {
            if (active.code !== code) return db.legalDocument.update({ where: { id: active.id }, data: { code } });
            return active;
        }
        await db.legalDocument.update({ where: { id: active.id }, data: { isActive: false } });
    }

    const existingSystemDoc = await db.legalDocument.findFirst({ where: { type, version: config.version, url: config.url }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] });
    if (existingSystemDoc) {
        if (!existingSystemDoc.isActive || existingSystemDoc.code !== code) {
            await db.legalDocument.updateMany({ where: { type }, data: { isActive: false } });
            return db.legalDocument.update({ where: { id: existingSystemDoc.id }, data: { isActive: true, code } });
        }
        return existingSystemDoc;
    }

    await db.legalDocument.updateMany({ where: { type }, data: { isActive: false } });
    return db.legalDocument.create({ data: { type, code, version: config.version, url: config.url, isActive: true, publishedAt: config.publishedAt } });
}

export async function ensureActiveLegalDocuments(types: readonly LegalDocType[] = LEGAL_DOC_TYPES) {
    const documents: LegalDocument[] = [];
    for (const type of types) {
        const doc = await ensureSystemLegalDocument(type);
        if (doc) documents.push(doc);
    }
    return documents;
}

export async function getActiveLegalDocuments(types: readonly LegalDocType[] = LEGAL_DOC_TYPES) {
    await ensureActiveLegalDocuments(types);
    return db.legalDocument.findMany({ where: { isActive: true, type: { in: [...types] } }, orderBy: [{ type: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }] });
}

export async function getActiveLegalDocument(type: LegalDocType) {
    const [doc] = await getActiveLegalDocuments([type]);
    return doc ?? null;
}
