import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required" }, { status: 400 })
        }

        // Check if email is valid format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
        }

        // Check if user exists with this email
        const existingUser = await db.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                emailVerified: true,
                accounts: {
                    select: { provider: true }
                }
            }
        })

        if (!existingUser) {
            // New user - can register via email
            return NextResponse.json({
                exists: false,
                canUseEmail: true,
                message: null
            })
        }

        // Check if user has OAuth account
        const oauthProviders = existingUser.accounts
            ?.map(acc => acc.provider)
            .filter(p => p !== "nodemailer") || []

        if (oauthProviders.length > 0) {
            // User registered via OAuth - suggest using that method
            const providerName = oauthProviders.includes("yandex") ? "Яндекс" : oauthProviders[0]
            return NextResponse.json({
                exists: true,
                canUseEmail: false,
                provider: oauthProviders[0],
                providerName,
                message: `Этот email связан с аккаунтом ${providerName}. Войдите через ${providerName}.`
            })
        }

        // User exists but registered via email - can login via email
        return NextResponse.json({
            exists: true,
            canUseEmail: true,
            message: null
        })

    } catch (error) {
        console.error("[check-email] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
