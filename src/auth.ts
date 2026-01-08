import NextAuth from "next-auth"
import Yandex from "next-auth/providers/yandex"
import Nodemailer from "next-auth/providers/nodemailer"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"

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
})
