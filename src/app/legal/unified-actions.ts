"use server"

import { db } from "@/lib/db"
import { getActiveLegalDocument, getActiveLegalDocuments, LEGAL_DOC_TYPES, REQUIRED_LEGAL_DOC_TYPES, type LegalDocType } from "@/lib/legal-documents"

export async function acceptActiveDocuments(_userId: string, types: LegalDocType[] = REQUIRED_LEGAL_DOC_TYPES) {
    await getActiveLegalDocuments(types)
    return { success: true }
}

export async function getActiveDocuments(types?: LegalDocType[]) {
    const docs = await getActiveLegalDocuments(types ?? LEGAL_DOC_TYPES)
    return { success: true, data: docs }
}

export async function checkUserAcceptance(userId: string, types: LegalDocType[] = REQUIRED_LEGAL_DOC_TYPES) {
    const activeDocs = await getActiveLegalDocuments(types)
    const accepted = await db.legalDocumentAcceptance.findMany({
        where: { userId, documentId: { in: activeDocs.map((doc) => doc.id) } },
        select: { documentId: true },
    })
    const acceptedIds = new Set(accepted.map((item) => item.documentId))
    return { success: true, needsAcceptance: activeDocs.filter((doc) => !acceptedIds.has(doc.id)) }
}

export async function acceptDocumentsByIds(userId: string, documentIds: string[]) {
    const activeDocs = await getActiveLegalDocuments(LEGAL_DOC_TYPES)
    const activeIds = new Set(activeDocs.map((doc) => doc.id))
    const ids = documentIds.filter((id) => activeIds.has(id))
    if (ids.length) {
        await db.legalDocumentAcceptance.createMany({
            data: ids.map((documentId) => ({ userId, documentId, ipAddress: "web" })),
            skipDuplicates: true,
        })
    }
    return { success: true }
}

export async function toggleAdsConsent(userId: string, accept: boolean) {
    const doc = await getActiveLegalDocument("ADS")
    if (!doc) return { success: false, error: "No active ADS document found" }
    if (accept) {
        await db.legalDocumentAcceptance.upsert({
            where: { userId_documentId: { userId, documentId: doc.id } },
            update: {},
            create: { userId, documentId: doc.id, ipAddress: "web" },
        })
    } else {
        await db.legalDocumentAcceptance.deleteMany({ where: { userId, documentId: doc.id } })
    }
    return { success: true }
}

export async function getAdsConsentStatus(userId: string) {
    const doc = await getActiveLegalDocument("ADS")
    if (!doc) return { success: true, hasAnswered: true, isAccepted: false }
    const acceptance = await db.legalDocumentAcceptance.findUnique({ where: { userId_documentId: { userId, documentId: doc.id } } })
    return { success: true, hasAnswered: !!acceptance, isAccepted: !!acceptance }
}
