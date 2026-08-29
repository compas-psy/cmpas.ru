import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTransport } from 'nodemailer';
import { html, text } from '@/lib/email-template';
import * as crypto from 'crypto';

/**
 * POST /api/mobile/auth/login
 * Request a magic link for mobile login.
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json(
                { error: 'Invalid email' },
                { status: 400 }
            );
        }

        // Generate a short-lived token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

        // Store token in DB (using NextAuth verification_token table)
        await db.verificationToken.create({
            data: {
                identifier: email.toLowerCase(),
                token,
                expires,
            },
        });

        // Build magic link URL (mobile app will intercept via deep link)
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://cmpas.ru';
        const magicLink = `${baseUrl}/api/mobile/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;

        // Send email
        const transport = createTransport({
            host: process.env.EMAIL_SERVER_HOST,
            port: Number(process.env.EMAIL_SERVER_PORT),
            ...(process.env.EMAIL_SERVER_USER && {
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                },
            }),
            tls: { rejectUnauthorized: false },
        });

        await transport.sendMail({
            to: email,
            from: process.env.EMAIL_FROM || 'noreply@cmpas.ru',
            subject: 'Вход в ПРАКТИКУ',
            text: text({ url: magicLink, host: 'cmpas.ru' }),
            html: html({ url: magicLink, host: 'cmpas.ru', theme: {} }),
        });

        return NextResponse.json({
            success: true,
            message: 'Magic link sent',
        });
    } catch (error) {
        console.error('[mobile/auth/login]', error);
        return NextResponse.json(
            { error: 'Failed to send magic link' },
            { status: 500 }
        );
    }
}
