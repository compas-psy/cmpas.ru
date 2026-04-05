"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

/**
 * Ensures the caller is an ADMIN or SUPERADMIN before performing destructuve actions
 */
async function ensureAdmin() {
    const session = await auth()
    const userRole = (session?.user as { role?: string })?.role

    if (!session?.user || (userRole !== "ADMIN" && userRole !== "SUPERADMIN")) {
        throw new Error("Unauthorized: Only Admins can perform this action.")
    }
}

export async function toggleUserBlock(userId: string, isBlocked: boolean) {
    await ensureAdmin()

    await db.user.update({
        where: { id: userId },
        data: { isBlocked }
    })

    revalidatePath("/admin/users")
}

export async function changeUserRole(userId: string, newRole: "USER" | "ADMIN" | "SUPERADMIN") {
    await ensureAdmin()

    await db.user.update({
        where: { id: userId },
        data: { role: newRole }
    })

    revalidatePath("/admin/users")
}

export async function resetUserSettings(userId: string) {
    await ensureAdmin()

    // Find the user's psychologist ID
    const settings = await db.psychologistSettings.findUnique({
        where: { psychologistId: userId }
    })

    if (settings) {
        // Delete all availability slots associated with this user
        await db.availabilitySlot.deleteMany({
            where: { psychologistId: userId }
        })

        // Finally delete the settings themselves
        await db.psychologistSettings.delete({
            where: { psychologistId: userId }
        })
    }

    revalidatePath("/admin/users")
    return { success: true }
}

async function setTrialRaw(userId: string, date: Date) {
    // Use raw SQL to set trialEndsAt — works even before Prisma types are regenerated
    await db.$executeRaw`UPDATE "User" SET "trialEndsAt" = ${date} WHERE id = ${userId}`
}

export async function extendUserTrial(userId: string, days: number) {
    await ensureAdmin()
    const rows = await db.$queryRaw<{ trialEndsAt: Date | null }[]>`
        SELECT "trialEndsAt" FROM "User" WHERE id = ${userId} LIMIT 1
    `
    const cur = rows[0]?.trialEndsAt
    const base = (cur && cur > new Date()) ? cur : new Date()
    const newEnd = new Date(base)
    newEnd.setDate(newEnd.getDate() + days)
    await setTrialRaw(userId, newEnd)
    revalidatePath("/admin/users")
    return { success: true, trialEndsAt: newEnd }
}

export async function resetUserTrialFromNow(userId: string, days: number) {
    await ensureAdmin()
    const newEnd = new Date()
    newEnd.setDate(newEnd.getDate() + days)
    await setTrialRaw(userId, newEnd)
    revalidatePath("/admin/users")
    return { success: true, trialEndsAt: newEnd }
}

export async function setUserTrialForever(userId: string) {
    await ensureAdmin()
    await setTrialRaw(userId, new Date('2099-01-01'))
    revalidatePath("/admin/users")
    return { success: true }
}

export async function deleteUserAccount(userId: string) {
    await ensureAdmin()

    // Thanks to Prisma's onDelete: Cascade, deleting the User model
    // automatically handles related Accounts, Sessions, DiarySessions, etc.
    await db.user.delete({
        where: { id: userId }
    })

    revalidatePath("/admin/users")
    return { success: true }
}
