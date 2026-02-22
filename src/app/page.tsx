import type { Metadata } from 'next';
import Header from '@/components/psidairy/Header';
import Hero from '@/components/psidairy/Hero';
import ValueSection from '@/components/psidairy/ValueSection';
import Gallery from '@/components/psidairy/Gallery';
import Reviews from '@/components/psidairy/Reviews';
import Specifications from '@/components/psidairy/Specifications';
import PriceDelivery from '@/components/psidairy/PriceDelivery';
import FAQ from '@/components/psidairy/FAQ';
import OrderForm from '@/components/psidairy/OrderForm';
import Footer from '@/components/psidairy/Footer';

export const metadata: Metadata = {
  title: "Ежедневник Психолога — купить профессиональный планер для записей сессий",
  description: "Ежедневник психолога с анкетами клиентов, разделом супервизии и местом для записей сессий. Формат А5, 272 страницы. Разработан практикующими психологами. Доставка по России.",
  keywords: [
    "ежедневник психолога",
    "купить ежедневник для психолога",
    "планер психолога",
    "блокнот психолога",
    "записи сессий психолога",
    "анкета клиента психолога",
    "ежедневник для частной практики",
    "супервизия записи",
    "инструменты психолога",
    "профилактика выгорания психолога"
  ],
  openGraph: {
    title: "Ежедневник Психолога | Compas",
    description: "Профессиональный ежедневник с анкетами клиентов, записями сессий и разделом супервизии. Ваш компас в мире психологии.",
    url: 'https://cmpas.ru',
    siteName: 'Compas',
    images: [
      {
        url: '/images/hero.jpg',
        width: 1200,
        height: 630,
        alt: 'Ежедневник Психолога — профессиональный планер для психологов',
      }
    ],
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ежедневник Психолога | Compas',
    description: 'Профессиональный ежедневник для записей сессий и супервизии',
    images: ['/images/hero.jpg'],
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
    description: 'Профессиональный ежедневник для психолога с анкетами клиентов, разделом для записей сессий и супервизии. Разработан практикующими психологами для частной практики.',
    brand: {
      '@type': 'Brand',
      name: 'Compas',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://www.ozon.ru/product/ezhednevnik-nedatirovannyy-a5-listov-272-3514667316/',
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Compas',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '47',
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
      <Reviews />
      <Specifications />
      <PriceDelivery />
      <FAQ />
      <OrderForm />
      <Footer />
    </main>
  );
}

