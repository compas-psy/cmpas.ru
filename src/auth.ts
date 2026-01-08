import NextAuth from "next-auth"
import Yandex from "next-auth/providers/yandex"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(db),
    providers: [
        Yandex({
            clientId: process.env.YANDEX_CLIENT_ID,
            clientSecret: process.env.YANDEX_CLIENT_SECRET,
        }),
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST || "localhost",
                port: Number(process.env.EMAIL_SERVER_PORT) || 25,
                auth: {
                    user: process.env.EMAIL_SERVER_USER || "noreply@cmpas.ru",
                    pass: process.env.EMAIL_SERVER_PASSWORD || "",
                },
            },
            from: process.env.EMAIL_FROM || "noreply@cmpas.ru",
        }),
    ],
    pages: {
        signIn: "/auth",
        verifyRequest: "/auth/verify",
    },
    secret: process.env.NEXTAUTH_SECRET,
    trustHost: true,
    callbacks: {
        async signIn({ user, account, profile }) {
            // Log successful sign-in
            await createAuditLog({
                userId: user.id,
                email: user.email || undefined,
                action: "LOGIN_SUCCESS",
                provider: account?.provider as "yandex" | "email",
                metadata: {
                    accountType: account?.type,
                    providerId: account?.providerAccountId,
                }
            })
            return true
        },
        async session({ session, user }) {
            if (session.user) {
                session.user.id = user.id
                session.user.role = (user as any).role || "USER"
            }
            return session
        },
    },
    events: {
        async createUser({ user }) {
            // Log new user creation
            await createAuditLog({
                userId: user.id,
                email: user.email || undefined,
                action: "SIGNUP",
            })
        },
    },
})
