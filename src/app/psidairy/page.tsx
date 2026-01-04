import Header from '@/components/psidairy/Header';
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
