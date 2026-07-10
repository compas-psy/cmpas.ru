"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import {
    getActiveLegalDocument,
    getActiveLegalDocuments,
    LEGAL_DOC_TYPES,
    REQUIRED_LEGAL_DOC_TYPES,
    type LegalDocType,
} from "@/lib/legal-documents"

type ActiveDoc = Awaited<ReturnType<typeof getActiveLegalDocuments>>[number]

async function writeAcceptance(userId: string, doc: ActiveDoc, ipAddress: string, source = "web") {
    await db.$executeRaw`
        INSERT INTO "LegalDocumentAcceptance" (id, "userId", "documentId", "acceptedAt", "ipAddress", source, "documentType", "documentVersion")
        VALUES (${randomUUID()}, ${userId}, ${doc.id}, NOW(), ${ipAddress}, ${source}, ${doc.type}, ${doc.version})
        ON CONFLICT ("userId", "documentId") DO UPDATE
        SET source = EXCLUDED.source,
            "documentType" = COALESCE("LegalDocumentAcceptance"."documentType", EXCLUDED."documentType"),
            "documentVersion" = COALESCE("LegalDocumentAcceptance"."documentVersion", EXCLUDED."documentVersion")
    `
}

export async function acceptActiveDocuments(userId: string, types: LegalDocType[] = REQUIRED_LEGAL_DOC_TYPES) {
    try {
        const ipAddress = await currentIpAddress()
        const activeDocs = await getActiveLegalDocuments(types)

        if (!activeDocs.length) return { success: true }

        for (const doc of activeDocs) {
            await writeAcceptance(userId, doc, ipAddress)
        }

        return { success: true }
    } catch (error) {
        console.error("Error accepting active documents:", error)
        return { success: false, error: "Failed to accept documents" }
    }
}

export async function getActiveDocuments(types?: LegalDocType[]) {
    try {
        const docs = await getActiveLegalDocuments(types ?? LEGAL_DOC_TYPES)
        return { success: true, data: docs }
    } catch (error) {
        console.error("Error fetching active documents:", error)
        return { success: false, error: "Failed to fetch active documents" }
    }
}

export async function checkUserAcceptance(userId: string, types: LegalDocType[] = REQUIRED_LEGAL_DOC_TYPES) {
    try {
        const activeDocs = await getActiveLegalDocuments(types)
        if (!activeDocs.length) return { success: true, needsAcceptance: [] }

        const activeDocIds = activeDocs.map((doc) => doc.id)
        const userAcceptances = await db.legalDocumentAcceptance.findMany({
            where: { userId, documentId: { in: activeDocIds } },
            select: { documentId: true },
        })

        const acceptedDocIds = new Set(userAcceptances.map((acceptance) => acceptance.documentId))
        const unacceptedDocs = activeDocs.filter((doc) => !acceptedDocIds.has(doc.id))

        return { success: true, needsAcceptance: unacceptedDocs }
    } catch (error) {
        console.error("Error checking user document acceptance:", error)
        return { success: false, error: "Failed to check acceptance status" }
    }
}

export async function acceptDocumentsByIds(userId: string, documentIds: string[]) {
    try {
        const ipAddress = await currentIpAddress()
        const activeDocs = await getActiveLegalDocuments(LEGAL_DOC_TYPES)
        const activeDocIds = new Set(activeDocs.map((doc) => doc.id))
        const allowedDocs = activeDocs.filter((doc) => documentIds.includes(doc.id) && activeDocIds.has(doc.id))

        if (!allowedDocs.length) return { success: true }

        for (const doc of allowedDocs) {
            await writeAcceptance(userId, doc, ipAddress)
        }

        return { success: true }
    } catch (error) {
        console.error("Error accepting documents by IDs:", error)
        return { success: false, error: "Failed to accept documents" }
    }
}

export async function toggleAdsConsent(userId: string, accept: boolean) {
    try {
        const activeAdsDoc = await getActiveLegalDocument("ADS")
        if (!activeAdsDoc) return { success: false, error: "No active ADS document found" }

        if (accept) {
            const ipAddress = await currentIpAddress()
            await writeAcceptance(userId, activeAdsDoc, ipAddress)
        } else {
            await db.legalDocumentAcceptance.deleteMany({ where: { userId, documentId: activeAdsDoc.id } })
        }

        return { success: true }
    } catch (error) {
        console.error("Error toggling ADS consent:", error)
        return { success: false, error: "Failed to toggle ADS consent" }
    }
}

export async function getAdsConsentStatus(userId: string) {
    try {
        const activeAdsDoc = await getActiveLegalDocument("ADS")
        if (!activeAdsDoc) return { success: true, hasAnswered: true, isAccepted: false }

        const acceptance = await db.legalDocumentAcceptance.findUnique({
            where: { userId_documentId: { userId, documentId: activeAdsDoc.id } },
        })

        return { success: true, hasAnswered: !!acceptance, isAccepted: !!acceptance }
    } catch (error) {
        console.error("Error getting ADS consent status:", error)
        return { success: false, error: "Failed to get ADS consent status" }
    }
}

async function currentIpAddress() {
    try {
        const headersList = await headers()
        return headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"
    } catch (_error) {
        return "unknown"
    }
}
