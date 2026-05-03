'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const navLinks = [
    { href: '#how-it-works', label: 'Как работает' },
    { href: '#features', label: 'Возможности' },
    { href: '#psychologist-day', label: 'Для психолога' },
    { href: '#client-flow', label: 'Для клиента' },
    { href: '#security', label: 'Безопасность' },
    { href: '#pricing', label: 'Тариф' },
];

export default function LandingHeader() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? 'bg-[#F7F8F4]/82 backdrop-blur-[18px] border-b border-[#E4E9E3]/70 shadow-[0_1px_8px_rgba(20,32,24,0.04)]'
                    : 'bg-transparent'
            }`}
        >
            <div className="max-w-[1240px] mx-auto px-5 md:px-8 h-[72px] md:h-[80px] flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 shrink-0">
                    <Image src="/icon.png" alt="КОМПАС" width={32} height={32} className="w-8 h-8 rounded-lg" />
                    <span className="text-[17px] font-bold tracking-[0.12em] text-forest-800 uppercase">КОМПАС</span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden lg:flex items-center gap-1">
                    {navLinks.map(link => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="px-3.5 py-2 text-[14px] font-medium text-[#5F6C64] hover:text-forest-800 transition-colors rounded-lg hover:bg-sage-100/60"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* CTA buttons */}
                <div className="flex items-center gap-2.5">
                    <Link
                        href="/auth"
                        className="hidden md:inline-flex px-4 py-2.5 text-[14px] font-semibold text-forest-800 border border-[#E4E9E3] rounded-[14px] hover:bg-sage-50 transition-all"
                    >
                        Войти
                    </Link>
                    <Link
                        href="/auth"
                        className="inline-flex px-4 md:px-5 py-2.5 text-[14px] font-semibold text-white bg-forest-800 rounded-[14px] hover:bg-forest-700 transition-all active:scale-[0.97] shadow-sm"
                    >
                        <span className="hidden sm:inline">Попробовать бесплатно</span>
                        <span className="sm:hidden">Попробовать</span>
                    </Link>

                    {/* Mobile burger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="lg:hidden p-2 -mr-2 text-forest-800"
                        aria-label="Меню"
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile nav */}
            {mobileOpen && (
                <div className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-[#E4E9E3] px-5 pb-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <nav className="flex flex-col gap-1 pt-3">
                        {navLinks.map(link => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="px-4 py-3 text-[15px] font-medium text-foreground rounded-xl hover:bg-sage-50 transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                        <Link
                            href="/auth"
                            onClick={() => setMobileOpen(false)}
                            className="mt-2 px-4 py-3 text-[15px] font-semibold text-forest-800 border border-[#E4E9E3] rounded-xl text-center hover:bg-sage-50 transition-colors"
                        >
                            Войти
                        </Link>
                    </nav>
                </div>
            )}
        </header>
    );
}
