import type { Metadata } from 'next';
import Header from '@/components/psidairy/Header';
import Hero from '@/components/psidairy/Hero';
import ValueSection from '@/components/psidairy/ValueSection';
import Gallery from '@/components/psidairy/Gallery';
import Specifications from '@/components/psidairy/Specifications';
import PriceDelivery from '@/components/psidairy/PriceDelivery';
import FAQ from '@/components/psidairy/FAQ';
import OrderForm from '@/components/psidairy/OrderForm';
import Footer from '@/components/psidairy/Footer';

export const metadata: Metadata = {
  title: "Ежедневник Психолога | Compas",
  description: "Профессиональный ежедневник для психолога. Структурируйте сессии, супервизии и личную практику. Идеальный инструмент для психологов, коучей и терапевтов.",
  keywords: ["ежедневник психолога", "купить ежедневник для психолога", "планер психолога", "блокнот психолога", "супервизия", "психологическая практика", "инструменты психолога"],
  openGraph: {
    title: "Ежедневник Психолога | Compas",
    description: "Ваш профессиональный компас в мире психологии. Структура, рефлексия, баланс.",
    url: 'https://cmpas.ru',
    siteName: 'Compas',
    images: [
      {
        url: '/images/hero.jpg',
        width: 1200,
        height: 630,
        alt: 'Ежедневник Психолога',
      }
    ],
    locale: 'ru_RU',
    type: 'website',
  },
  alternates: {
    canonical: 'https://cmpas.ru',
  }
};

export default function Home() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ежедневник Психолога',
    image: 'https://cmpas.ru/images/hero.jpg',
    description: 'Профессиональный ежедневник для психолога. Структурируйте сессии, супервизии и личную практику.',
    brand: {
      '@type': 'Brand',
      name: 'Compas',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://cmpas.ru',
      priceCurrency: 'RUB',
      price: '1790',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  return (
    <main className="min-h-screen bg-background font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <Hero />
      <ValueSection />
      <Gallery />
      <Specifications />
      <PriceDelivery />
      <FAQ />
      <OrderForm />
      <Footer />
    </main>
  );
}
