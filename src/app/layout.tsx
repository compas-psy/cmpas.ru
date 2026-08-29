import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cmpas.ru'),
  title: {
    default: "ПРАКТИКА — онлайн-кабинет психолога для записи, клиентов и заметок",
    template: "%s | ПРАКТИКА"
  },
  description: "ПРАКТИКА помогает психологам вести расписание, клиентскую базу, запись на сессии, заметки и уведомления через Telegram и MAX.",
  keywords: ["кабинет психолога", "запись на сессию", "онлайн запись психолог", "crm психолога", "расписание психолога", "клиенты психолога", "заметки после сессии"],
  icons: {
    icon: "/icon.png?v=2",
    apple: "/icon.png?v=2",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    yandex: "yandex_a4dcf0b1028cb8a9",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        {/* Preload LCP image for faster mobile loading */}
        <link
          rel="preload"
          as="image"
          href="/images/hero.jpg"
          type="image/jpeg"
        />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a4d3a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ПРАКТИКА" />
        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106317472', 'ym');
            ym(106317472, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/106317472" style={{ position: 'absolute', left: '-9999px' }} alt="" />
          </div>
        </noscript>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  );
}

