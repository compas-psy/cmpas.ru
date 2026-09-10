import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { isAccountProvider, providerDisplayName } from "@/lib/auth/simpasid"
import { insensitiveEmailWhere } from "@/lib/auth/email-identity"

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

        // Поиск без учёта регистра — тот же, что в адаптере входа.
        //
        // Здесь стояло `email.toLowerCase()` при точном сравнении: вход
        // приводился к нижнему регистру, а ЗАПИСАННОЕ — нет. То есть человек
        // с адресом `Ivan@ya.ru` в базе не находился никогда, каким бы
        // регистром он его ни набрал, и экран отвечал «такого нет» тому, кто
        // у нас есть.
        const existingUser = await db.user.findFirst({
            where: insensitiveEmailWhere(email),
            orderBy: { createdAt: 'asc' },
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
            .filter(isAccountProvider) || []

        if (oauthProviders.length > 0) {
            // User registered via OAuth - suggest using that method.
            // Имя берётся из общего справочника: раньше всё, что не
            // «yandex», показывалось человеку идентификатором из
            // конфигурации — латиницей и без объяснений.
            const providerName = providerDisplayName(
                oauthProviders.includes("yandex") ? "yandex" : oauthProviders[0])
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
