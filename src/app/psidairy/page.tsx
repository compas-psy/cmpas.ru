import type { Metadata } from 'next';
import Header from '@/components/psidairy/Header';

export const metadata: Metadata = {
    title: "Ежедневник Психолога PsiDairy | Compas",
    description: "Профессиональный ежедневник для психолога. Структурируйте сессии, супервизии и личную практику. Идеальный инструмент для психологов, коучей и терапевтов.",
    keywords: ["ежедневник психолога", "купить ежедневник для психолога", "планер психолога", "блокнот психолога", "супервизия", "психологическая практика", "инструменты психолога"],
    openGraph: {
        title: "Ежедневник Психолога PsiDairy",
        description: "Ваш профессиональный компас в мире психологии. Структура, рефлексия, баланс.",
        images: ['/images/hero.jpg'], // Using existing hero image
    }
};

export default function PsidairyPage() {
    return (
        <main className="min-h-screen bg-background font-sans">
            <Header />
            import Hero from '@/components/psidairy/Hero';
            import ValueSection from '@/components/psidairy/ValueSection';
            import Gallery from '@/components/psidairy/Gallery';
            import Specifications from '@/components/psidairy/Specifications';
            import PriceDelivery from '@/components/psidairy/PriceDelivery';
            import FAQ from '@/components/psidairy/FAQ';
            import OrderForm from '@/components/psidairy/OrderForm';
            import Footer from '@/components/psidairy/Footer';

            export default function PsidairyPage() {
    return (
            <main className="min-h-screen bg-background font-sans">
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
