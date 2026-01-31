import NextAuth from "next-auth"
import Yandex from "next-auth/providers/yandex"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import { html, text } from "@/lib/email-template"
// @ts-expect-error - nodemailer types not installed due to peer dep conflict
import { createTransport } from "nodemailer"

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
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id;
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

