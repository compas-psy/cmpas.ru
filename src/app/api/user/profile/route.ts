import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

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
            sessionBreak,
            hasLunchBreak,
            lunchStartTime,
            lunchEndTime
        } = body

        // 1. Update user profile
        const user = await db.user.update({
            where: { email: session.user.email },
            data: {
                name,
                emailVerified: new Date(), // Mark as verified after onboarding
            }
        })

        // 2. Upsert Psychologist Settings
        const settings = await db.psychologistSettings.upsert({
            where: { psychologistId: user.id },
            update: {
                methods: methods || [],
                basePrice: basePrice || 0,
                defaultSessionDuration: defaultSessionDuration || 50,
                sessionBreak: sessionBreak || 15,
            },
            create: {
                psychologistId: user.id,
                methods: methods || [],
                basePrice: basePrice || 0,
                defaultSessionDuration: defaultSessionDuration || 50,
                sessionBreak: sessionBreak || 15,
            }
        })

        // 3. Re-create Availability Slots based on workDays array
        if (Array.isArray(workDays) && workDays.length === 7) {
            // First, delete any existing basic recurring slots created during a previous onboarding
            // We only delete slots without an explicit startDate to avoid wiping out specific exceptions.
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
                        // Split into two slots: Morning and Afternoon
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: startTime || "09:00",
                            endTime: lunchStartTime,
                            duration: defaultSessionDuration || 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: lunchEndTime,
                            endTime: endTime || "18:00",
                            duration: defaultSessionDuration || 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                    } else {
                        // Single continuous slot
                        newSlots.push({
                            psychologistId: user.id,
                            dayOfWeek: dayIdx,
                            startTime: startTime || "09:00",
                            endTime: endTime || "18:00",
                            duration: defaultSessionDuration || 50,
                            format: "online",
                            isRecurring: true,
                            isActive: true
                        })
                    }
                }
            }

            if (newSlots.length > 0) {
                await db.availabilitySlot.createMany({
                    data: newSlots
                })
            }
        }

        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
