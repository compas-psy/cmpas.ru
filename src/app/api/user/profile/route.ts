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
        const { name, email, timezone } = body

        // Update user profile
        await db.user.update({
            where: { email: session.user.email },
            data: {
                name,
                emailVerified: new Date(), // Mark as verified after onboarding
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
