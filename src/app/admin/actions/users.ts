"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

/**
 * Ensures the caller is an ADMIN or SUPERADMIN before performing destructive actions.
 * Returns the admin's userId for logging.
 */
async function ensureAdmin(): Promise<string> {
    const session = await auth()
    const userRole = (session?.user as { role?: string })?.role

    if (!session?.user?.id || (userRole !== "ADMIN" && userRole !== "SUPERADMIN")) {
        throw new Error("Unauthorized: Only Admins can perform this action.")
    }
    return session.user.id
}

async function logAction(adminId: string, action: string, targetUserId?: string, payload?: Record<string, any>) {
    try {
        await db.adminActionLog.create({
            data: { adminId, action, targetUserId, payload: payload ? JSON.stringify(payload) : null }
        })
    } catch { /* don't block the action if logging fails */ }
}

export async function toggleUserBlock(userId: string, isBlocked: boolean) {
    const adminId = await ensureAdmin()

    await db.user.update({
        where: { id: userId },
        data: { isBlocked }
    })

    await logAction(adminId, isBlocked ? 'block' : 'unblock', userId)
    revalidatePath("/admin/users")
}

export async function changeUserRole(userId: string, newRole: "USER" | "ADMIN" | "SUPERADMIN") {
    const adminId = await ensureAdmin()
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })

    await db.user.update({
        where: { id: userId },
        data: { role: newRole }
    })

    await logAction(adminId, 'role_change', userId, { oldRole: user?.role, newRole })
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
    const adminId = await ensureAdmin()

    // Delete in order of dependencies
    await db.diarySession.deleteMany({ where: { psychologistId: userId } })
    await db.diaryClient.deleteMany({ where: { psychologistId: userId } })
    await db.availabilitySlot.deleteMany({ where: { psychologistId: userId } })
    await db.diaryBlock.deleteMany({ where: { psychologistId: userId } })
    await db.timeBlock.deleteMany({ where: { psychologistId: userId } })
    await db.calendarIntegration.deleteMany({ where: { psychologistId: userId } })
    await db.notificationSettings.deleteMany({ where: { psychologistId: userId } })
    await db.psychologistSettings.deleteMany({ where: { psychologistId: userId } })

    await logAction(adminId, 'test_reset', userId)
    revalidatePath("/admin/users")
    return { success: true }
}

async function setTrialRaw(userId: string, date: Date) {
    // Use raw SQL to set trialEndsAt — works even before Prisma types are regenerated
    await db.$executeRaw`UPDATE "User" SET "trialEndsAt" = ${date} WHERE id = ${userId}`
}

export async function extendUserTrial(userId: string, days: number) {
    const adminId = await ensureAdmin()
    const rows = await db.$queryRaw<{ trialEndsAt: Date | null }[]>`
        SELECT "trialEndsAt" FROM "User" WHERE id = ${userId} LIMIT 1
    `
    const cur = rows[0]?.trialEndsAt
    const base = (cur && cur > new Date()) ? cur : new Date()
    const newEnd = new Date(base)
    newEnd.setDate(newEnd.getDate() + days)
    await setTrialRaw(userId, newEnd)
    await logAction(adminId, 'trial_reset', userId, { days, type: 'extend', newEnd: newEnd.toISOString() })
    revalidatePath("/admin/users")
    return { success: true, trialEndsAt: newEnd }
}

export async function resetUserTrialFromNow(userId: string, days: number) {
    const adminId = await ensureAdmin()
    const newEnd = new Date()
    newEnd.setDate(newEnd.getDate() + days)
    await setTrialRaw(userId, newEnd)
    await logAction(adminId, 'trial_reset', userId, { days, type: 'reset_from_now', newEnd: newEnd.toISOString() })
    revalidatePath("/admin/users")
    return { success: true, trialEndsAt: newEnd }
}

export async function setUserTrialForever(userId: string) {
    const adminId = await ensureAdmin()
    await setTrialRaw(userId, new Date('2099-01-01'))
    await logAction(adminId, 'trial_forever', userId)
    revalidatePath("/admin/users")
    return { success: true }
}

/**
 * Что исчезнет вместе с аккаунтом.
 *
 * Считается ДО удаления и теми же запросами, которыми досье уже показывает
 * эти числа. Нужно в двух местах: в вопросе перед удалением и в записи
 * журнала после него.
 */
export async function deleteUserImpact(userId: string) {
    await ensureAdmin()
    // Клиенты и встречи, и только они. Заметки отдельной таблицей не живут —
    // они поля внутри встречи, — поэтому считать их отдельным числом значило
    // бы выдумать сущность ради красивой строки. Встречи их и уносят.
    const [user, clients, sessions] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
        db.diaryClient.count({ where: { psychologistId: userId } }).catch(() => 0),
        db.diarySession.count({ where: { psychologistId: userId } }).catch(() => 0),
    ])
    if (!user) return null
    return { email: user.email, name: user.name, clients, sessions }
}

export async function deleteUserAccount(userId: string) {
    const adminId = await ensureAdmin()

    // ЗАПИСЬ ОБЯЗАНА ПЕРЕЖИТЬ САМОГО ПОЛЬЗОВАТЕЛЯ.
    //
    // Раньше в журнал уходило только слово «delete» и идентификатор. После
    // удаления идентификатор ни на что не указывает — строки больше нет, — и
    // сказать, чей это был аккаунт, продукт уже не мог. Для сервиса, который
    // держит данные чужих клиентов, «что именно исчезло» спросят первым.
    //
    // Снимок делается ДО удаления и теми же запросами, которыми досье эти
    // числа уже считает: новых сущностей не заводится.
    const impact = await deleteUserImpact(userId)
    await logAction(adminId, 'delete', userId, impact ?? { note: 'пользователь не найден' })

    // Thanks to Prisma's onDelete: Cascade, deleting the User model
    // automatically handles related Accounts, Sessions, DiarySessions, etc.
    await db.user.delete({
        where: { id: userId }
    })

    revalidatePath("/admin/users")
    return { success: true }
}

/**
 * Написать человеку из досье — в ЕГО мессенджер.
 *
 * Раньше это была третья по счёту прямая отправка в api.telegram.org в
 * админке, и телеграм-только: у кого привязан один MAX, того учредитель из
 * досье не доставал вовсе — получал «не привязан Telegram» и всё.
 *
 * Теперь канал выбирает общее правило продукта (pickChannel: основной, иначе
 * тот, что есть), а отправка идёт общим путём — с прокси и таймаутом.
 * Имя функции оставлено прежним: его знают вызывающие места, а менять имя
 * заодно с поведением значит прятать правку.
 */
export async function sendTelegramMessage(userId: string, message: string) {
    await ensureAdmin()

    const user = await db.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, maxChatId: true, name: true }
    })

    if (!user?.telegramChatId && !user?.maxChatId) {
        return { success: false, error: 'У пользователя не привязан ни один мессенджер' }
    }

    const { deliverMessage } = await import('@/lib/messaging/deliver')
    const delivery = await deliverMessage(
        { telegramChatId: user.telegramChatId, maxChatId: user.maxChatId, preferredChannel: null },
        message,
    )

    if (!delivery.sent) {
        return {
            success: false,
            error: delivery.channel
                ? `Не удалось отправить в ${delivery.channel === 'max' ? 'MAX' : 'Telegram'}`
                : 'Писать некуда',
        }
    }
    return { success: true }
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
