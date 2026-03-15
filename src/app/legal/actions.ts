"use server"

import { db } from "@/lib/db"
import { headers } from "next/headers"

// Types of legal documents
export const DOC_TYPES = {
    TERMS: "TERMS",
    PRIVACY: "PRIVACY",
    ADS: "ADS"
} as const

export type DocType = keyof typeof DOC_TYPES

/**
 * Ensures that a user has accepted the currently active versions of the specified documents.
 * Typically called right after login or during registration.
 */
export async function acceptActiveDocuments(userId: string, types: DocType[] = ["TERMS", "PRIVACY"]) {
    try {
        let ipAddress = "unknown";
        try {
            const headersList = await headers()
            ipAddress = headersList.get("x-forwarded-for") || "unknown"
        } catch (e) {
            // Might safely fail in NextAuth background events
        }

        const activeDocs = await db.legalDocument.findMany({
            where: {
                isActive: true,
                type: { in: types }
            }
        })

        if (!activeDocs.length) return { success: true }

        // We use individual create records, upsert or createMany (createMany doesn't support skipDuplicates natively in some Prisma PG setups if complex)
        // Actually, createMany with skipDuplicates is supported in Postgres
        const acceptances = activeDocs.map(doc => ({
            userId,
            documentId: doc.id,
            ipAddress
        }))

        await db.legalDocumentAcceptance.createMany({
            data: acceptances,
            skipDuplicates: true
        })

        return { success: true }
    } catch (error) {
        console.error("Error accepting active documents:", error)
        return { success: false, error: "Failed to accept documents" }
    }
}

/**
 * Returns the currently active legal documents
 */
export async function getActiveDocuments(types?: DocType[]) {
    try {
        const docs = await db.legalDocument.findMany({
            where: {
                isActive: true,
                ...(types ? { type: { in: types } } : {})
            }
        })
        return { success: true, data: docs }
    } catch (error) {
        console.error("Error fetching active documents:", error)
        return { success: false, error: "Failed to fetch active documents" }
    }
}

/**
 * Checks if the user has accepted ALL currently active documents of the specified types.
 * Used by layout/middleware to trigger redirect.
 */
export async function checkUserAcceptance(userId: string, types: DocType[] = ["TERMS", "PRIVACY"]) {
    try {
        const activeDocs = await db.legalDocument.findMany({
            where: {
                isActive: true,
                type: { in: types }
            }
        })

        if (!activeDocs.length) return { success: true, needsAcceptance: [] }

        const activeDocIds = activeDocs.map(d => d.id)

        const userAcceptances = await db.legalDocumentAcceptance.findMany({
            where: {
                userId,
                documentId: { in: activeDocIds }
            }
        })

        const acceptedDocIds = new Set(userAcceptances.map(a => a.documentId))
        const unacceptedDocs = activeDocs.filter(d => !acceptedDocIds.has(d.id))

        return { 
            success: true, 
            needsAcceptance: unacceptedDocs 
        }
    } catch (error) {
        console.error("Error checking user document acceptance:", error)
        return { success: false, error: "Failed to check acceptance status" }
    }
}

/**
 * Explicitly accept a list of specific document IDs
 */
export async function acceptDocumentsByIds(userId: string, documentIds: string[]) {
    try {
        let ipAddress = "unknown";
        try {
            const headersList = await headers()
            ipAddress = headersList.get("x-forwarded-for") || "unknown"
        } catch (e) {}

        await db.legalDocumentAcceptance.createMany({
            data: documentIds.map(id => ({
                userId,
                documentId: id,
                ipAddress
            })),
            skipDuplicates: true
        })

        return { success: true }
    } catch (error) {
        console.error("Error accepting documents by IDs:", error)
        return { success: false, error: "Failed to accept documents" }
    }
}

/**
 * Toggles ADS consent for a user.
 * If there's an active ADS document, it adds or removes the acceptance.
 */
export async function toggleAdsConsent(userId: string, accept: boolean) {
    try {
        const activeAdsDoc = await db.legalDocument.findFirst({
            where: { isActive: true, type: DOC_TYPES.ADS }
        })

        if (!activeAdsDoc) return { success: false, error: "No active ADS document found" }

        if (accept) {
            let ipAddress = "unknown";
            try {
                const headersList = await headers()
                ipAddress = headersList.get("x-forwarded-for") || "unknown"
            } catch (e) {}
            
            await db.legalDocumentAcceptance.upsert({
                where: {
                    userId_documentId: {
                        userId,
                        documentId: activeAdsDoc.id
                    }
                },
                update: {},
                create: {
                    userId,
                    documentId: activeAdsDoc.id,
                    ipAddress
                }
            })
        } else {
            await db.legalDocumentAcceptance.deleteMany({
                where: {
                    userId,
                    documentId: activeAdsDoc.id
                }
            })
        }

        return { success: true }
    } catch (error) {
        console.error("Error toggling ADS consent:", error)
        return { success: false, error: "Failed to toggle ADS consent" }
    }
}

/**
 * Checks if the user has evaluated the current ADS document.
 * Returns { hasAnswered: boolean, isAccepted: boolean }
 */
export async function getAdsConsentStatus(userId: string) {
    try {
        const activeAdsDoc = await db.legalDocument.findFirst({
            where: { isActive: true, type: DOC_TYPES.ADS }
        })

        if (!activeAdsDoc) return { success: true, hasAnswered: true, isAccepted: false }

        const acceptance = await db.legalDocumentAcceptance.findUnique({
            where: {
                userId_documentId: {
                    userId,
                    documentId: activeAdsDoc.id
                }
            }
        })

        // Instead of strict "hasAnswered" logic (which requires tracking explicit denies), 
        // we might just check if they are prompted. For now we assume if they accepted it, they have answered.
        // Wait, if they denied, there's no record. To track explicit deny, we'd need another field or negative record.
        // Let's modify the modal to only show once by using a client-side localStorage flag for "prompted_ads".
        
        return { 
            success: true, 
            hasAnswered: !!acceptance, 
            isAccepted: !!acceptance 
        }
    } catch (error) {
        console.error("Error getting ADS consent status:", error)
        return { success: false, error: "Failed to get ADS consent status" }
    }
}
