"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

async function ensureAdmin() {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
        throw new Error("Unauthorized")
    }
}

export async function getAdminLegalDocs() {
    await ensureAdmin()
    try {
        const docs = await db.legalDocument.findMany({
            orderBy: [{ type: "asc" }, { version: "desc" }]
        })
        return { success: true, data: docs }
    } catch (error) {
        console.error("Error fetching admin legal docs:", error)
        return { success: false, error: "Failed to load documents" }
    }
}

export async function setActiveLegalDoc(id: string, type: "TERMS" | "PRIVACY" | "ADS") {
    await ensureAdmin()
    try {
        // Run in transaction to securely deactivate others
        await db.$transaction([
            db.legalDocument.updateMany({
                where: { type },
                data: { isActive: false }
            }),
            db.legalDocument.update({
                where: { id },
                data: { isActive: true }
            })
        ])
        revalidatePath("/admin/legal")
        return { success: true }
    } catch (error) {
        console.error("Error setting active doc:", error)
        return { success: false, error: "Failed to update active status" }
    }
}

export async function createLegalDoc(data: { type: "TERMS" | "PRIVACY" | "ADS", version: string, url: string, isActive: boolean }) {
    await ensureAdmin()
    try {
        if (data.isActive) {
            await db.legalDocument.updateMany({
                where: { type: data.type },
                data: { isActive: false }
            })
        }
        await db.legalDocument.create({
            data: {
                ...data,
                publishedAt: new Date()
            }
        })
        revalidatePath("/admin/legal")
        return { success: true }
    } catch (error) {
        console.error("Error creating doc:", error)
        return { success: false, error: "Failed to create document format" }
    }
}

export async function deleteLegalDoc(id: string) {
    await ensureAdmin()
    try {
        await db.legalDocument.delete({ where: { id } })
        revalidatePath("/admin/legal")
        return { success: true }
    } catch (error) {
        console.error("Error deleting doc:", error)
        return { success: false, error: "Failed to delete document. May have tracking dependencies." }
    }
}

/**
 * QA-only: clear the current admin's own LegalDocumentAcceptance rows so the
 * /legal-acceptance gate can be re-tested without bumping a document version
 * (which would force EVERY user to re-consent). Deliberately self-only —
 * no id/email parameter — so this can't be used to reset another user's
 * acceptance without direct DB access.
 */
export async function resetMyLegalAcceptance() {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.id || (role !== "ADMIN" && role !== "SUPERADMIN")) {
        throw new Error("Unauthorized")
    }
    await db.legalDocumentAcceptance.deleteMany({ where: { userId: session.user.id } })
    revalidatePath("/admin/legal")
    revalidatePath("/diary")
    return { success: true }
}
