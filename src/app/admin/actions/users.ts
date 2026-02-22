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
    await ensureSuperAdmin()

    await db.user.update({
        where: { id: userId },
        data: { isBlocked }
    })

    revalidatePath("/admin/users")
}

export async function changeUserRole(userId: string, newRole: "USER" | "ADMIN" | "SUPERADMIN") {
    await ensureSuperAdmin()

    await db.user.update({
        where: { id: userId },
        data: { role: newRole }
    })

    revalidatePath("/admin/users")
}

export async function resetUserSettings(userId: string) {
    await ensureSuperAdmin()

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

export async function deleteUserAccount(userId: string) {
    await ensureSuperAdmin()

    // Thanks to Prisma's onDelete: Cascade, deleting the User model
    // automatically handles related Accounts, Sessions, DiarySessions, etc.
    await db.user.delete({
        where: { id: userId }
    })

    revalidatePath("/admin/users")
    return { success: true }
}
