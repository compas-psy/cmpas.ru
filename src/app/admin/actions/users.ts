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

/**
 * Full test-mode reset: wipe all user data (clients, sessions, settings, slots)
 * so the user can redo onboarding from scratch.
 */
export async function testModeReset(userId: string) {
    await ensureAdmin()

    // Delete in order of dependencies
    // 1. Delete all sessions
    await db.diarySession.deleteMany({ where: { psychologistId: userId } })

    // 2. Delete all clients (cascades to questionnaires, therapy goals, etc.)
    await db.diaryClient.deleteMany({ where: { psychologistId: userId } })

    // 3. Delete availability slots
    await db.availabilitySlot.deleteMany({ where: { psychologistId: userId } })

    // 4. Delete diary blocks
    await db.diaryBlock.deleteMany({ where: { psychologistId: userId } })

    // 5. Delete time blocks
    await db.timeBlock.deleteMany({ where: { psychologistId: userId } })

    // 6. Delete calendar integrations
    await db.calendarIntegration.deleteMany({ where: { psychologistId: userId } })

    // 7. Delete notification settings
    await db.notificationSettings.deleteMany({ where: { psychologistId: userId } })

    // 8. Delete psychologist settings (this triggers onboarding again)
    await db.psychologistSettings.deleteMany({ where: { psychologistId: userId } })

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

/**
 * Send a message to a user via Telegram Bot API.
 * Requires the user to have a telegramChatId set.
 */
export async function sendTelegramMessage(userId: string, message: string) {
    await ensureAdmin()

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, name: true }
    })

    if (!user?.telegramChatId) {
        return { success: false, error: 'У пользователя не привязан Telegram' }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
        return { success: false, error: 'TELEGRAM_BOT_TOKEN не настроен' }
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegramChatId,
                text: message,
                parse_mode: 'HTML',
            }),
        })

        const data = await res.json()
        if (!data.ok) {
            return { success: false, error: data.description || 'Ошибка Telegram API' }
        }

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Не удалось отправить сообщение' }
    }
}

/**
 * Get detailed user info for admin CRM profile
 */
export async function getUserDetails(userId: string) {
    await ensureAdmin()

    const user = await db.user.findUnique({
        where: { id: userId },
        include: {
            psychologistSettings: true,
            legalAcceptances: {
                include: { document: true }
            },
            payments: {
                orderBy: { createdAt: 'desc' },
                take: 10,
            },
        }
    })

    if (!user) return null

    // Get counts
    const [clientsCount, sessionsCount, totalSessionsCompleted] = await Promise.all([
        db.diaryClient.count({ where: { psychologistId: userId } }),
        db.diarySession.count({ where: { psychologistId: userId } }),
        db.diarySession.count({ where: { psychologistId: userId, status: 'completed' } }),
    ])

    return {
        ...user,
        _counts: {
            clients: clientsCount,
            sessions: sessionsCount,
            completedSessions: totalSessionsCompleted,
        }
    }
}
