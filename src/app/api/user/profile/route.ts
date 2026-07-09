import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const user = await db.user.findUnique({
            where: { email: session.user.email },
            select: {
                id: true,
                name: true,
                email: true,
                psychologistSettings: true,
            },
        })
        if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            psychologistSettings: user.psychologistSettings,
        })
    } catch (error) {
        console.error("Profile read error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const {
            name,
            methods,
            workDays,
            startTime,
            endTime,
            defaultSessionDuration,
            basePrice,
            timezone,
            sessionBreak,
            hasLunchBreak,
            lunchStartTime,
            lunchEndTime,
            cancellationHours,
            cancellationFee,
            cancellationText,
            psychologistSettings
        } = body

        const cleanTimezone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : psychologistSettings?.timezone || 'Europe/Moscow'
        const cleanSessionBreak = sessionBreak !== undefined ? Number(sessionBreak) : (psychologistSettings?.sessionBreak ?? 15)
        const cleanDuration = defaultSessionDuration !== undefined ? Number(defaultSessionDuration) : (psychologistSettings?.defaultSessionDuration ?? 50)
        const cleanCancellationHours = cancellationHours !== undefined ? Number(cancellationHours) : (psychologistSettings?.cancellationHours ?? 24)
        const cleanCancellationFee = cancellationFee !== undefined ? Number(cancellationFee) : (psychologistSettings?.cancellationFee ?? 50)

        // 1. Update user profile. Email comes from the authenticated session and is not overwritten by the client payload.
        const user = await db.user.update({
            where: { email: session.user.email },
            data: {
                ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
                emailVerified: new Date(),
            }
        })

        // 2. Upsert Psychologist Settings
        const settings = await db.psychologistSettings.upsert({
            where: { psychologistId: user.id },
            update: {
                timezone: cleanTimezone,
                methods: methods || [],
                basePrice: basePrice || 0,
                defaultSessionDuration: Number.isFinite(cleanDuration) ? cleanDuration : 50,
                sessionBreak: Number.isFinite(cleanSessionBreak) ? cleanSessionBreak : 15,
                cancellationHours: Number.isFinite(cleanCancellationHours) ? cleanCancellationHours : 24,
                cancellationFee: Number.isFinite(cleanCancellationFee) ? cleanCancellationFee : 50,
                cancellationText: cancellationText || psychologistSettings?.cancellationText || null,
                onlineSessionLink: psychologistSettings?.onlineSessionLink || null,
                onboardingCompleted: true,
            } as any,
            create: {
                psychologistId: user.id,
                timezone: cleanTimezone,
                methods: methods || [],
                basePrice: basePrice || 0,
                defaultSessionDuration: Number.isFinite(cleanDuration) ? cleanDuration : 50,
                sessionBreak: Number.isFinite(cleanSessionBreak) ? cleanSessionBreak : 15,
                cancellationHours: Number.isFinite(cleanCancellationHours) ? cleanCancellationHours : 24,
                cancellationFee: Number.isFinite(cleanCancellationFee) ? cleanCancellationFee : 50,
                cancellationText: cancellationText || psychologistSettings?.cancellationText || null,
                onlineSessionLink: psychologistSettings?.onlineSessionLink || null,
                onboardingCompleted: true,
            } as any
        })

        // 3. Re-create Availability Slots based on workDays array
        if (Array.isArray(workDays) && workDays.length === 7) {
            await db.availabilitySlot.deleteMany({
                where: {
                    psychologistId: user.id,
                    startDate: null,
                    endDate: null
                }
            })

            const newSlots = []
            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                if (workDays[dayIdx]) {
                    if (hasLunchBreak && lunchStartTime && lunchEndTime) {
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: startTime || "09:00",
                            endTime: lunchStartTime,
                            duration: Number.isFinite(cleanDuration) ? cleanDuration : 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: lunchEndTime,
                            endTime: endTime || "18:00",
                            duration: Number.isFinite(cleanDuration) ? cleanDuration : 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                    } else {
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: startTime || "09:00",
                            endTime: endTime || "18:00",
                            duration: Number.isFinite(cleanDuration) ? cleanDuration : 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                    }
                }
            }

            if (newSlots.length > 0) {
                await db.availabilitySlot.createMany({ data: newSlots })
            }
        }

        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
