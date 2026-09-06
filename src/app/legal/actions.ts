"use server"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { auth } from "@/auth"
import { headers } from "next/headers"
import {
    getActiveLegalDocument,
    getActiveLegalDocuments,
    LEGAL_DOC_TYPES,
    ACCOUNT_REQUIRED_TYPES,
    type LegalDocType,
} from "@/lib/legal-documents"

type ActiveDoc = Awaited<ReturnType<typeof getActiveLegalDocuments>>[number]

// Every action below acts on the CALLER's own legal acceptance record. None
// of them take a userId parameter: a "use server" export is a public HTTP
// endpoint, so a userId argument would be attacker-controlled input, not a
// trusted identity — exactly the "public legal actions must not accept an
// arbitrary userId as identity" rule from the Task 4 security review.
// Identity always comes from the session, derived here, never from a caller.
async function requireSessionUserId(): Promise<string> {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Unauthorized")
    return session.user.id
}

async function writeAcceptance(userId: string, doc: ActiveDoc, ipAddress: string, source = "web") {
    await db.$executeRaw`
        INSERT INTO "LegalDocumentAcceptance" (id, "userId", "documentId", "acceptedAt", "ipAddress", source, "documentType", "documentVersion", "documentCode")
        VALUES (${randomUUID()}, ${userId}, ${doc.id}, NOW(), ${ipAddress}, ${source}, ${doc.type}, ${doc.version}, ${doc.code})
        ON CONFLICT ("userId", "documentId") DO UPDATE
        SET source = EXCLUDED.source,
            "documentType" = COALESCE("LegalDocumentAcceptance"."documentType", EXCLUDED."documentType"),
            "documentVersion" = COALESCE("LegalDocumentAcceptance"."documentVersion", EXCLUDED."documentVersion"),
            "documentCode" = COALESCE("LegalDocumentAcceptance"."documentCode", EXCLUDED."documentCode")
    `
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

export async function checkUserAcceptance(types: LegalDocType[] = ACCOUNT_REQUIRED_TYPES) {
    try {
        const userId = await requireSessionUserId()
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

export async function acceptDocumentsByIds(documentIds: string[]) {
    try {
        const userId = await requireSessionUserId()
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

// Task 5: marketing consent is an append-only grant/revoke history, not a
// row that gets deleted on revoke. Revoking used to `deleteMany` the
// LegalDocumentAcceptance row outright — that destroyed the very evidence
// that consent had ever been given. Every toggle now INSERTs a new
// ConsentEvent; nothing here is ever updated or deleted. "all" is the only
// channel today because the product only has a single marketing toggle —
// the schema already supports per-channel (email/push/messenger/sms) rows
// for whenever that UI exists.
export async function toggleAdsConsent(accept: boolean) {
    try {
        const userId = await requireSessionUserId()
        const activeAdsDoc = await getActiveLegalDocument("ADS")
        if (!activeAdsDoc) return { success: false, error: "No active ADS document found" }

        await db.consentEvent.create({
            data: {
                userId,
                consentType: "marketing",
                channel: "all",
                status: accept ? "granted" : "revoked",
                documentVersion: activeAdsDoc.version,
                sourceEvent: "legal_actions_toggle_ads_consent",
            },
        })

        return { success: true }
    } catch (error) {
        console.error("Error toggling ADS consent:", error)
        return { success: false, error: "Failed to toggle ADS consent" }
    }
}

export async function getAdsConsentStatus() {
    try {
        const userId = await requireSessionUserId()
        const activeAdsDoc = await getActiveLegalDocument("ADS")
        if (!activeAdsDoc) return { success: true, hasAnswered: true, isAccepted: false }

        const latest = await db.consentEvent.findFirst({
            where: { userId, consentType: "marketing", channel: "all" },
            orderBy: { occurredAt: "desc" },
        })

        return { success: true, hasAnswered: !!latest, isAccepted: latest?.status === "granted" }
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
