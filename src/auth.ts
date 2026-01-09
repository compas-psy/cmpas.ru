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
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT),
                ...(process.env.EMAIL_SERVER_USER && {
                    auth: {
                        user: process.env.EMAIL_SERVER_USER,
                        pass: process.env.EMAIL_SERVER_PASSWORD,
                    },
                }),
            },
            from: process.env.EMAIL_FROM || "noreply@cmpas.ru",
        }),
    ],
    pages: {
        signIn: "/auth",
        verifyRequest: "/auth/verify",
    },
    debug: process.env.NODE_ENV === "development",
    secret: process.env.AUTH_SECRET,
    trustHost: true,
})
