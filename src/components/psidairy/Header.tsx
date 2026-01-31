"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        // Check initial scroll
        handleScroll();

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change or resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isMobileMenuOpen]);

    const navLinks = [
        { href: '/blog', label: 'Блог' },
        { href: '#развороты', label: 'Развороты' },
        { href: '#характеристики', label: 'Характеристики' },
        { href: '#доставка', label: 'Доставка' },
        { href: '#faq', label: 'FAQ' },
    ];

    const handleLinkClick = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <>
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

                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-8 text-sm text-foreground/80 font-normal">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="hover:text-primary transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Action Button - Hidden on mobile when menu is open */}
                        <Link
                            href="#order-form"
                            className="hidden sm:block bg-primary text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition shadow-sm"
                        >
                            Купить
                        </Link>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 focus:outline-none"
                            aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
                        >
                            <span
                                className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                                    }`}
                            />
                            <span
                                className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''
                                    }`}
                            />
                            <span
                                className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Menu Panel */}
            <nav
                className={`fixed top-20 right-0 w-72 h-[calc(100vh-5rem)] bg-background z-40 shadow-xl transform transition-transform duration-300 ease-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col p-6 space-y-4">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={handleLinkClick}
                            className="text-lg text-foreground/80 hover:text-primary transition-colors py-2 border-b border-border/50"
                        >
                            {link.label}
                        </Link>
                    ))}

                    {/* Mobile CTA Button */}
                    <Link
                        href="#order-form"
                        onClick={handleLinkClick}
                        className="mt-6 bg-primary text-white px-8 py-4 rounded-lg text-base font-medium hover:bg-primary/90 transition shadow-sm text-center"
                    >
                        Купить ежедневник
                    </Link>
                </div>
            </nav>
        </>
    );
}
