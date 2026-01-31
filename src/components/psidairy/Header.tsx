"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        // Check initial scroll
        handleScroll();

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`fixed top-0 w-full z-50 bg-background/95 backdrop-blur-sm transition-all duration-300 ${isScrolled ? 'border-b border-border shadow-sm' : 'border-b border-transparent'
            }`}>
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                <div className="flex items-center gap-12">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="relative w-32 h-8">
                            <Image
                                src="/images/logo.png"
                                alt="COMPAS"
                                fill
                                className="object-contain object-left"
                                priority
                            />
                        </div>
                    </Link>

                    {/* Desktop Nav - Closer to Logo, Thin Font */}
                    <nav className="hidden md:flex items-center gap-8 text-sm text-foreground/80 font-normal">
                        <Link href="/blog" className="hover:text-primary transition-colors">Блог</Link>
                        <Link href="#развороты" className="hover:text-primary transition-colors">Развороты</Link>
                        <Link href="#характеристики" className="hover:text-primary transition-colors">Характеристики</Link>
                        <Link href="#доставка" className="hover:text-primary transition-colors">Доставка</Link>
                        <Link href="#faq" className="hover:text-primary transition-colors">FAQ</Link>
                    </nav>
                </div>

                {/* Action Button */}
                <Link href="#order-form" className="bg-primary text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition shadow-sm">
                    Купить
                </Link>
            </div>
        </header>
    );
}
