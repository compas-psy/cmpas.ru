import NextAuth from "next-auth"
import Yandex from "next-auth/providers/yandex"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { html, text } from "@/lib/email-template"
import { linkVisitorAndTrackIdentity } from "@/lib/analytics/link-visitor"
import { track } from "@/lib/analytics/track"
import { VISITOR_ID_COOKIE } from "@/lib/analytics/visitor-cookie"
import { isSimpasIdConfigured, isSimpasIdEmailTrustworthy, SIMPASID_PROVIDER_ID } from "@/lib/auth/simpasid"
// @ts-expect-error - nodemailer types not installed due to peer dep conflict
import { createTransport } from "nodemailer"

// ============================================
// AUTH_SECRET VALIDATION (CRITICAL!)
// If AUTH_SECRET changes between deploys, ALL user sessions become invalid.
// This check provides early warning when the secret is misconfigured.
// ============================================
const PLACEHOLDER_SECRETS = [
    "changeme-in-production-please-secret-key",
    "secret-to-be-changed-in-production",
    "changeme",
]

if (!process.env.AUTH_SECRET) {
    console.error("[AUTH CRITICAL] AUTH_SECRET is not set! Authentication will not work.")
} else if (PLACEHOLDER_SECRETS.includes(process.env.AUTH_SECRET)) {
    console.error(
        `[AUTH CRITICAL] AUTH_SECRET is set to a placeholder value! ` +
        `Generate a real secret with: openssl rand -base64 32`
    )
} else {
    // Log fingerprint (first 8 chars) to help debug secret changes across deploys
    const fingerprint = process.env.AUTH_SECRET.substring(0, 8)
    console.log(`[AUTH] AUTH_SECRET fingerprint: ${fingerprint}... (stable = sessions preserved)`)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(db),
    session: {
        strategy: "database",
    },
    providers: [
        Yandex({
            clientId: process.env.YANDEX_CLIENT_ID,
            clientSecret: process.env.YANDEX_CLIENT_SECRET,
            authorization: {
                url: "https://oauth.yandex.ru/authorize",
                params: { scope: "login:email login:info" },
            },
        }),
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT),
                ...(process.env.EMAIL_SERVER_USER && {
                    auth: {
                        user: process.env.EMAIL_SERVER_USER,
                        pass: process.env.EMAIL_SERVER_PASSWORD,
                    },
                }),
                tls: {
                    rejectUnauthorized: false,
                },
            },
            from: process.env.EMAIL_FROM || "noreply@cmpas.ru",
            sendVerificationRequest: async ({ identifier: email, url, provider }) => {
                // Check if user already exists with this email AND has OAuth account
                const existingUser = await db.user.findUnique({
                    where: { email },
                    select: {
                        id: true,
                        emailVerified: true,
                        accounts: {
                            select: { provider: true }
                        }
                    }
                })

                // Only block if user has OAuth account (e.g., Yandex)
                // Allow email login for users who registered via email magic link
                const hasOAuthAccount = existingUser?.accounts?.some(
                    acc => acc.provider === "yandex"
                )

                if (existingUser?.emailVerified && hasOAuthAccount) {
                    // User registered via OAuth - they should use that method
                    console.log(`[auth] User ${email} has OAuth account, redirecting to use Yandex login`)
                    throw new Error("EMAIL_EXISTS")
                }

                const transport = createTransport(provider.server)
                const result = await transport.sendMail({
                    to: email,
                    from: provider.from,
                    subject: "Вход в Ежедневник Психолога",
                    text: text({ url, host: new URL(url).host }),
                    html: html({ url, host: new URL(url).host, theme: {} }),
                })
                const failed = result.rejected.concat(result.pending).filter(Boolean)
                if (failed.length) {
                    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`)
                }
            },
        }),
        // Единый вход СИМПАС. ДОБАВЛЯЕТСЯ третьим — Яндекс и почта на
        // месте и в прежнем порядке.
        //
        // `wellKnown` не задаётся намеренно: при заданном `issuer`
        // next-auth сам выводит {issuer}/.well-known/openid-configuration
        // (packages/core/src/lib/utils/providers.ts). Лишняя строка здесь
        // была бы вторым источником правды об одном и том же адресе.
        //
        // allowDangerousEmailAccountLinking — ТОЛЬКО этому провайдеру и
        // только потому, что issuer наш: без флага живой психолог при
        // первом входе через СИМПАС получил бы OAuthAccountNotLinked
        // вместо входа. Цена флага — доверие к почте провайдера, поэтому
        // ниже, в signIn, почта проверяется на подтверждённость.
        ...(isSimpasIdConfigured() ? [{
            id: SIMPASID_PROVIDER_ID,
            name: "СИМПАС",
            type: "oidc" as const,
            issuer: process.env.SIMPASID_ISSUER,
            clientId: process.env.SIMPASID_CLIENT_ID,
            clientSecret: process.env.SIMPASID_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }] : []),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            // Вход через СИМПАС — только с подтверждённой почтой.
            //
            // Проверка стоит ПЕРВОЙ и до всего остального намеренно:
            // @auth/core зовёт этот колбэк ДО handleLoginOrRegister
            // (packages/core/src/lib/actions/callback/index.ts:250 против
            // :257), то есть отказ здесь не оставляет ни созданного
            // пользователя, ни привязанного Account. Проверять после было
            // бы поздно.
            if (account?.provider === SIMPASID_PROVIDER_ID && !isSimpasIdEmailTrustworthy(profile)) {
                // Почту в журнал не пишем: это персональные данные.
                console.warn("[auth] СИМПАС: вход отклонён — почта не подтверждена или не пришла")
                return false
            }

            if (user?.id) {
                // Legal documents must never be accepted implicitly on sign-in.
                // The beta legal gate records TERMS/PRIVACY/ADS only after an explicit
                // checkbox/button action in web or Android, with version, date and source.
                try {
                    const dbUser = await db.user.findUnique({
                        where: { id: user.id },
                        select: { trialEndsAt: true },
                    });
                    if (!dbUser?.trialEndsAt) {
                        const trialEnd = new Date();
                        trialEnd.setDate(trialEnd.getDate() + 30);
                        await db.user.update({ where: { id: user.id }, data: { trialEndsAt: trialEnd } });
                    }
                } catch (e) {
                    console.error("[auth] trial init failed (migration may be pending):", e);
                }

                // B5 (charter/13_TRACKING_PLAN.md §2): связываем визит с
                // аккаунтом в момент, когда связь становится известна —
                // здесь и только здесь. Обёрнуто отдельным try/catch по
                // тому же принципу, что и блок триала выше: сбой этой
                // связки (нет куки, миграция ещё не применена, что угодно)
                // не должен мешать самому входу.
                try {
                    const cookieStore = await cookies();
                    const visitorId = cookieStore.get(VISITOR_ID_COOKIE)?.value ?? null;
                    await linkVisitorAndTrackIdentity(db, track, visitorId, user.id);
                } catch (e) {
                    console.error("[auth] visitor-account link failed:", e);
                }
            }
            return true;
        },
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
                // @ts-expect-error - role is extension
                session.user.role = (user as any).role;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth",
        verifyRequest: "/auth/verify",
        error: "/auth/error",
    },
    debug: process.env.NODE_ENV === "development",
    secret: process.env.AUTH_SECRET,
    trustHost: true,
})
