"use server"

import { db } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { sendMaxMessage } from "@/lib/max-bot"

async function getAdminId(): Promise<string> {
    const session = await auth()
    const userRole = (session?.user as { role?: string })?.role
    if (!session?.user?.id || (userRole !== "ADMIN" && userRole !== "SUPERADMIN")) {
        throw new Error("Unauthorized")
    }
    return session.user.id
}

// ── Admin Action Logging ──

export async function logAdminAction(action: string, targetUserId?: string, payload?: Record<string, any>) {
    const adminId = await getAdminId()
    await db.adminActionLog.create({
        data: {
            adminId,
            targetUserId,
            action,
            payload: payload ? JSON.stringify(payload) : null,
        }
    })
}

// ── Notes ──

export async function getUserNotes(userId: string) {
    await getAdminId()
    return db.userNote.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

export async function addUserNote(userId: string, content: string) {
    const adminId = await getAdminId()
    const note = await db.userNote.create({
        data: { userId, authorId: adminId, content }
    })
    await db.adminActionLog.create({
        data: { adminId, targetUserId: userId, action: 'note_added', payload: JSON.stringify({ noteId: note.id }) }
    })
    revalidatePath(`/admin/users/${userId}`)
    return note
}

export async function deleteUserNote(noteId: string) {
    const adminId = await getAdminId()
    const note = await db.userNote.findUnique({ where: { id: noteId } })
    if (!note) throw new Error("Note not found")
    await db.userNote.delete({ where: { id: noteId } })
    revalidatePath(`/admin/users/${note.userId}`)
}

export async function toggleNotePin(noteId: string) {
    await getAdminId()
    const note = await db.userNote.findUnique({ where: { id: noteId } })
    if (!note) throw new Error("Note not found")
    await db.userNote.update({
        where: { id: noteId },
        data: { pinned: !note.pinned }
    })
    revalidatePath(`/admin/users/${note.userId}`)
}

// ── Tags ──

export async function getUserTags(userId: string) {
    await getAdminId()
    return db.userTag.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

export async function addUserTag(userId: string, tag: string) {
    const adminId = await getAdminId()
    const normalizedTag = tag.trim().toLowerCase()
    if (!normalizedTag) throw new Error("Empty tag")

    const existing = await db.userTag.findUnique({
        where: { userId_tag: { userId, tag: normalizedTag } }
    })
    if (existing) return existing

    const created = await db.userTag.create({
        data: { userId, tag: normalizedTag, addedById: adminId }
    })
    await db.adminActionLog.create({
        data: { adminId, targetUserId: userId, action: 'tag_added', payload: JSON.stringify({ tag: normalizedTag }) }
    })
    revalidatePath(`/admin/users/${userId}`)
    return created
}

export async function removeUserTag(userId: string, tag: string) {
    const adminId = await getAdminId()
    await db.userTag.deleteMany({
        where: { userId, tag }
    })
    await db.adminActionLog.create({
        data: { adminId, targetUserId: userId, action: 'tag_removed', payload: JSON.stringify({ tag }) }
    })
    revalidatePath(`/admin/users/${userId}`)
}

// ── Messages ──

export async function sendAdminMessage(toUserId: string, channel: 'telegram' | 'max' | 'email', content: string, subject?: string) {
    const adminId = await getAdminId()

    const user = await db.user.findUnique({
        where: { id: toUserId },
        select: { telegramChatId: true, maxChatId: true, email: true, name: true }
    })
    if (!user) throw new Error("User not found")

    let status = 'sent'
    let errorMsg: string | null = null

    try {
        if (channel === 'telegram') {
            if (!user.telegramChatId) throw new Error('У пользователя не привязан Telegram')
            const botToken = process.env.TELEGRAM_BOT_TOKEN
            if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN не настроен')
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.telegramChatId, text: content, parse_mode: 'HTML' }),
            })
            const data = await res.json()
            if (!data.ok) throw new Error(data.description || 'Telegram API error')
        } else if (channel === 'max') {
            if (!user.maxChatId) throw new Error('У пользователя не привязан MAX')
            await sendMaxMessage(user.maxChatId, content)
        } else if (channel === 'email') {
            if (!user.email) throw new Error('У пользователя нет email')
            await sendEmail(user.email, subject || 'Сообщение от КОМПАС', content)
        }
        status = 'delivered'
    } catch (err: any) {
        status = 'failed'
        errorMsg = err.message || 'Unknown error'
    }

    const message = await db.adminMessage.create({
        data: {
            fromAdminId: adminId,
            toUserId,
            channel,
            subject: channel === 'email' ? subject : null,
            content,
            status,
            errorMsg,
        }
    })

    await db.adminActionLog.create({
        data: {
            adminId,
            targetUserId: toUserId,
            action: 'message_sent',
            payload: JSON.stringify({ channel, status, messageId: message.id }),
        }
    })

    revalidatePath(`/admin/users/${toUserId}`)
    return { success: status !== 'failed', error: errorMsg, messageId: message.id }
}

export async function getMessageHistory(userId: string) {
    await getAdminId()
    return db.adminMessage.findMany({
        where: { toUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
}

// ── Activity Log ──

export async function getAdminActionLog(targetUserId: string, take = 50) {
    await getAdminId()
    return db.adminActionLog.findMany({
        where: { targetUserId },
        orderBy: { createdAt: 'desc' },
        take,
    })
}

// ── Enhanced getUserDetails ──

export async function getUserDetailsFull(userId: string) {
    const adminId = await getAdminId()

    const user = await db.user.findUnique({
        where: { id: userId },
        include: {
            psychologistSettings: true,
            accounts: { select: { provider: true, type: true } },
            legalAcceptances: {
                include: { document: true },
                orderBy: { acceptedAt: 'desc' },
            },
            payments: {
                orderBy: { createdAt: 'desc' },
            },
            notificationSettings: true,
        }
    })

    if (!user) return null

    // Get counts
    const [
        clientsCount,
        sessionsCount,
        completedSessions,
        slotsCount,
        sessionsLast30,
        upcomingSessions,
        calendarIntegrations,
        addresses,
        tags,
        notes,
        recentAudit,
        recentAdminActions,
    ] = await Promise.all([
        db.diaryClient.count({ where: { psychologistId: userId } }),
        db.diarySession.count({ where: { psychologistId: userId } }),
        db.diarySession.count({ where: { psychologistId: userId, status: 'completed' } }),
        db.availabilitySlot.count({ where: { psychologistId: userId, isActive: true } }),
        db.diarySession.count({
            where: {
                psychologistId: userId,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            }
        }),
        db.diarySession.findMany({
            where: { psychologistId: userId, date: { gte: new Date() }, status: { not: 'cancelled' } },
            include: { client: { select: { name: true } } },
            orderBy: { date: 'asc' },
            take: 5,
        }),
        db.calendarIntegration.findMany({
            where: { psychologistId: userId },
            select: { provider: true, accountEmail: true, isActive: true },
        }),
        db.psychologistAddress.findMany({ where: { psychologistId: userId } }),
        db.userTag.findMany({ where: { userId } }),
        db.userNote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
        db.auditLog.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: 5,
        }),
        db.adminActionLog.findMany({
            where: { targetUserId: userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        }),
    ])

    const totalPaid = user.payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0)

    return {
        ...user,
        _counts: {
            clients: clientsCount,
            sessions: sessionsCount,
            completedSessions,
            slots: slotsCount,
            sessionsLast30,
            totalPaid,
        },
        _upcomingSessions: upcomingSessions,
        _calendarIntegrations: calendarIntegrations,
        _addresses: addresses,
        _tags: tags,
        _notes: notes,
        _recentAudit: recentAudit,
        _recentAdminActions: recentAdminActions,
    }
}

// ── Mass Communications ──

export async function getSegmentCount(segment: string, tagFilter?: string[]) {
    const adminId = await getAdminId()

    const now = new Date()
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    let where: any = {}

    switch (segment) {
        case 'all':
            break
        case 'trial_active':
            where = { trialEndsAt: { gt: now } }
            break
        case 'trial_expiring_7d':
            where = { trialEndsAt: { gt: now, lt: sevenDaysFromNow } }
            break
        case 'subscription_active':
            where = { subscriptionEndsAt: { gt: now } }
            break
        case 'subscription_expired':
            where = {
                OR: [
                    { subscriptionEndsAt: { lt: now } },
                    { subscriptionEndsAt: null },
                ],
                trialEndsAt: { lt: now },
            }
            break
        case 'no_telegram':
            where = { telegramChatId: null }
            break
        case 'by_tag':
            if (!tagFilter?.length) return { total: 0, telegram: 0, max: 0, email: 0 }
            const taggedUserIds = await db.userTag.findMany({
                where: { tag: { in: tagFilter } },
                select: { userId: true },
                distinct: ['userId'],
            })
            where = { id: { in: taggedUserIds.map(t => t.userId) } }
            break
    }

    const users = await db.user.findMany({
        where,
        select: { telegramChatId: true, maxChatId: true, email: true },
    })

    return {
        total: users.length,
        telegram: users.filter(u => u.telegramChatId).length,
        max: users.filter(u => u.maxChatId).length,
        email: users.filter(u => u.email).length,
    }
}

export async function sendMassCommunication(
    segment: string,
    channel: 'telegram' | 'max' | 'email',
    content: string,
    subject?: string,
    tagFilter?: string[]
) {
    const adminId = await getAdminId()

    const now = new Date()
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    let where: any = {}

    switch (segment) {
        case 'all': break
        case 'trial_active': where = { trialEndsAt: { gt: now } }; break
        case 'trial_expiring_7d': where = { trialEndsAt: { gt: now, lt: sevenDaysFromNow } }; break
        case 'subscription_active': where = { subscriptionEndsAt: { gt: now } }; break
        case 'subscription_expired':
            where = { OR: [{ subscriptionEndsAt: { lt: now } }, { subscriptionEndsAt: null }], trialEndsAt: { lt: now } }
            break
        case 'no_telegram': where = { telegramChatId: null }; break
        case 'by_tag':
            if (!tagFilter?.length) return { sent: 0, failed: 0 }
            const taggedUserIds = await db.userTag.findMany({
                where: { tag: { in: tagFilter } }, select: { userId: true }, distinct: ['userId'],
            })
            where = { id: { in: taggedUserIds.map(t => t.userId) } }
            break
    }

    // Filter by channel capability
    if (channel === 'telegram') where.telegramChatId = { not: null }
    else if (channel === 'max') where.maxChatId = { not: null }
    else if (channel === 'email') where.email = { not: null }

    const users = await db.user.findMany({
        where,
        select: { id: true, name: true, email: true, telegramChatId: true, maxChatId: true, trialEndsAt: true },
    })

    let sent = 0, failed = 0

    for (const user of users) {
        try {
            // Replace variables
            const trialDaysLeft = user.trialEndsAt ?
                Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
            let personalizedContent = content
                .replace(/\{name\}/g, user.name || 'Пользователь')
                .replace(/\{email\}/g, user.email || '')
                .replace(/\{trialDaysLeft\}/g, String(trialDaysLeft))

            let personalizedSubject = subject?.replace(/\{name\}/g, user.name || 'Пользователь') || ''

            if (channel === 'telegram') {
                const botToken = process.env.TELEGRAM_BOT_TOKEN
                if (!botToken || !user.telegramChatId) { failed++; continue }
                const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.telegramChatId, text: personalizedContent, parse_mode: 'HTML' }),
                })
                const data = await res.json()
                if (!data.ok) { failed++; continue }
            } else if (channel === 'max') {
                if (!user.maxChatId) { failed++; continue }
                await sendMaxMessage(user.maxChatId, personalizedContent)
            } else if (channel === 'email') {
                if (!user.email) { failed++; continue }
                await sendEmail(user.email, personalizedSubject || 'Сообщение от КОМПАС', personalizedContent)
            }

            // Record message
            await db.adminMessage.create({
                data: {
                    fromAdminId: adminId, toUserId: user.id, channel, subject: personalizedSubject || null,
                    content: personalizedContent, status: 'delivered',
                }
            })
            sent++
        } catch {
            failed++
        }
    }

    await db.adminActionLog.create({
        data: {
            adminId,
            action: 'mass_communication',
            payload: JSON.stringify({ segment, channel, sent, failed, total: users.length }),
        }
    })

    return { sent, failed }
}

// ── All Tags (for filters) ──

export async function getAllTags() {
    await getAdminId()
    const tags = await db.userTag.findMany({
        select: { tag: true },
        distinct: ['tag'],
        orderBy: { tag: 'asc' },
    })
    return tags.map(t => t.tag)
}
