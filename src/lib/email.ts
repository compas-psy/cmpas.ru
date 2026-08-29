// Email sender using Nodemailer
// SMTP env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.yandex.ru',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
    },
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@cmpas.ru';

/**
 * Send a branded email using the ПРАКТИКА template style
 */
export async function sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    const brandColor = '#1a4d3a';
    const accentColor = '#c9a961';

    const fullHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" style="max-width: 480px;">
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="vertical-align: middle; padding-right: 12px;">
                                        <img src="https://cmpas.ru/logo-tree.png" alt="" width="32" height="32" style="display: block;">
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <span style="font-size: 18px; font-weight: 600; color: ${brandColor}; letter-spacing: 0.5px;">
                                            ЕЖЕДНЕВНИК ПСИХОЛОГА
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Main Card -->
                    <tr>
                        <td>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding: 40px 32px;">
                                        <h1 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: ${brandColor};">
                                            ${subject}
                                        </h1>
                                        <div style="font-size: 15px; line-height: 1.7; color: #374151;">
                                            ${htmlContent}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 20px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #999;">
                                © Ежедневник Психолога · cmpas.ru
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    await transporter.sendMail({
        from: `"ПРАКТИКА" <${FROM}>`,
        to,
        subject,
        html: fullHtml,
    });
}
