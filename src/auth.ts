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
    },
    debug: process.env.NODE_ENV === "development",
    secret: process.env.AUTH_SECRET,
    trustHost: true,
})

