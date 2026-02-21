import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Запись на сессию',
    description: 'Booking Mini App',
};

export default function BotLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru">
            <head>
                {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                <script src="https://telegram.org/js/telegram-web-app.js"></script>
            </head>
            <body className="bg-background text-foreground antialiased min-h-screen">
                {children}
            </body>
        </html>
    );
}
