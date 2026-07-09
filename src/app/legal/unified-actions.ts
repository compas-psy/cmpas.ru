"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { getActiveLegalDocument, getActiveLegalDocuments, LEGAL_DOC_TYPES, REQUIRED_LEGAL_DOC_TYPES, type LegalDocType } from "@/lib/legal-documents"

type ActiveDoc = Awaited<ReturnType<typeof getActiveLegalDocuments>>[number]

async function writeAcceptance(userId: string, doc: ActiveDoc, source = "web") {
    await db.$executeRaw`
        INSERT INTO "LegalDocumentAcceptance" (id, "userId", "documentId", "acceptedAt", "ipAddress", source, "documentType", "documentVersion")
        VALUES (${randomUUID()}, ${userId}, ${doc.id}, NOW(), ${source}, ${source}, ${doc.type}, ${doc.version})
        ON CONFLICT ("userId", "documentId") DO UPDATE
        SET source = EXCLUDED.source,
            "documentType" = COALESCE("LegalDocumentAcceptance"."documentType", EXCLUDED."documentType"),
            "documentVersion" = COALESCE("LegalDocumentAcceptance"."documentVersion", EXCLUDED."documentVersion")
    `
}

export async function acceptActiveDocuments(userId: string, types: LegalDocType[] = REQUIRED_LEGAL_DOC_TYPES) {
    const docs = await getActiveLegalDocuments(types)
    for (const doc of docs) {
        await writeAcceptance(userId, doc)
    }
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
    const ids = new Set(documentIds)
    for (const doc of activeDocs) {
        if (ids.has(doc.id)) await writeAcceptance(userId, doc)
    }
    return { success: true }
}

export async function toggleAdsConsent(userId: string, accept: boolean) {
    const doc = await getActiveLegalDocument("ADS")
    if (!doc) return { success: false, error: "No active ADS document found" }
    if (accept) {
        await writeAcceptance(userId, doc)
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
