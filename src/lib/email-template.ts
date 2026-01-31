export function html(params: { url: string; host: string; theme?: Record<string, unknown> }) {
    const { url, host } = params

    const escapedHost = host.replace(/\./g, "&#8203;.")

    const brandColor = "#1a4d3a"
    const buttonTextColor = "#ffffff"
    const accentColor = "#c9a961"

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход в Ежедневник Психолога</title>
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
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${brandColor}; border-radius: 24px; overflow: hidden;">
                                <tr>
                                    <td style="padding: 48px 40px; text-align: center;">
                                        <!-- Icon -->
                                        <div style="width: 64px; height: 64px; background-color: rgba(255,255,255,0.1); border-radius: 50%; margin: 0 auto 24px; line-height: 64px;">
                                            <span style="font-size: 28px;">✉️</span>
                                        </div>
                                        
                                        <!-- Title -->
                                        <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: ${buttonTextColor};">
                                            Войти в аккаунт
                                        </h1>
                                        
                                        <!-- Description -->
                                        <p style="margin: 0 0 32px; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.8);">
                                            Нажмите кнопку ниже, чтобы войти<br>
                                            в Ежедневник Психолога
                                        </p>
                                        
                                        <!-- Button -->
                                        <a href="${url}" target="_blank" style="display: inline-block; background-color: ${accentColor}; color: ${brandColor}; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 16px;">
                                            Войти
                                        </a>
                                        
                                        <!-- Secondary Text -->
                                        <p style="margin: 32px 0 0; font-size: 13px; color: rgba(255,255,255,0.5);">
                                            Ссылка действительна 24 часа
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 20px; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 12px; color: #666;">
                                Если вы не запрашивали этот email, просто проигнорируйте его.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #999;">
                                © Ежедневник Психолога · ${escapedHost}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`
}

export function text({ url, host }: { url: string; host: string }) {
    return `Войти в Ежедневник Психолога\n\nПерейдите по ссылке: ${url}\n\nСсылка действительна 24 часа.\n\nЕсли вы не запрашивали этот email, просто проигнорируйте его.\n\n© Ежедневник Психолога · ${host}`
}
