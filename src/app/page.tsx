import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import BeforeAfter from '@/components/landing/BeforeAfter';
import HowItWorks from '@/components/landing/HowItWorks';
import PsychologistDay from '@/components/landing/PsychologistDay';
import ClientFlow from '@/components/landing/ClientFlow';
import Features from '@/components/landing/Features';
import PositioningBand from '@/components/landing/PositioningBand';
import Security from '@/components/landing/Security';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/Footer';

export const metadata: Metadata = {
    title: "ПРАКТИКА — онлайн-кабинет психолога для записи, клиентов и заметок",
    description: "ПРАКТИКА помогает психологам вести расписание, клиентскую базу, запись на сессии, заметки и уведомления через Telegram и MAX.",
    keywords: [
        "кабинет психолога",
        "запись на сессию онлайн",
        "онлайн запись психолог",
        "расписание психолога",
        "клиенты психолога",
        "заметки после сессии",
        "telegram бот психолога",
    ],
    openGraph: {
        title: "ПРАКТИКА — умный кабинет психолога",
        description: "Клиенты сами записываются, а вы видите день, клиентов и заметки в одном спокойном рабочем пространстве.",
        url: 'https://cmpas.ru',
        siteName: 'ПРАКТИКА',
        locale: 'ru_RU',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'ПРАКТИКА — умный кабинет психолога',
        description: 'Запись, клиенты, заметки и уведомления в одном спокойном рабочем пространстве.',
    },
    alternates: {
        canonical: 'https://cmpas.ru',
    },
};

export default function HomePage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'ПРАКТИКА',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'Онлайн-кабинет для психологов: запись клиентов, расписание, заметки и уведомления через Telegram и MAX.',
        url: 'https://cmpas.ru',
        offers: {
            '@type': 'Offer',
            price: '990',
            priceCurrency: 'RUB',
            priceValidUntil: '2027-12-31',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            reviewCount: '47',
        },
        author: {
            '@type': 'Organization',
            name: 'ПРАКТИКА',
        },
    };

    return (
        <main className="min-h-screen bg-[#F7F8F4] font-[family-name:var(--font-geist-sans)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LandingHeader />
            <Hero />
            <BeforeAfter />
            <HowItWorks />
            <PsychologistDay />
            <ClientFlow />
            <Features />
            <PositioningBand />
            <Security />
            <Pricing />
            <FAQ />
            <FinalCTA />
            <LandingFooter />
        </main>
    );
}
