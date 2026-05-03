import Link from 'next/link';
import Image from 'next/image';

const footerLinks = {
    product: [
        { href: '#how-it-works', label: 'Как работает' },
        { href: '#features', label: 'Возможности' },
        { href: '#client-flow', label: 'Для клиента' },
        { href: '#pricing', label: 'Тариф' },
    ],
    company: [
        { href: '/paperdiary', label: 'Ежедневник' },
        { href: 'https://t.me/psy_notebook', label: 'Telegram-канал' },
    ],
    support: [
        { href: '#security', label: 'Безопасность' },
        { href: 'https://t.me/psy_notebook', label: 'Написать нам' },
    ],
    legal: [
        { href: '/legal/privacy', label: 'Политика конфиденциальности' },
        { href: '/legal/terms', label: 'Пользовательское соглашение' },
    ],
};

export default function LandingFooter() {
    return (
        <footer className="bg-forest-800 text-white pt-16 pb-8">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2.5 mb-3">
                            <Image src="/icon.png" alt="" width={28} height={28} className="rounded-lg" />
                            <span className="text-[15px] font-bold tracking-wider uppercase">КОМПАС</span>
                        </div>
                        <p className="text-[13px] text-white/50 leading-snug max-w-[200px]">
                            Умный кабинет психолога в мессенджере
                        </p>
                    </div>

                    {/* Продукт */}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-4">Продукт</div>
                        <div className="space-y-2.5">
                            {footerLinks.product.map(l => (
                                <a key={l.href} href={l.href} className="block text-[13px] text-white/60 hover:text-white transition-colors">{l.label}</a>
                            ))}
                        </div>
                    </div>

                    {/* Компания */}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-4">Компания</div>
                        <div className="space-y-2.5">
                            {footerLinks.company.map(l => (
                                <Link key={l.href} href={l.href} className="block text-[13px] text-white/60 hover:text-white transition-colors">{l.label}</Link>
                            ))}
                        </div>
                    </div>

                    {/* Поддержка */}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-4">Поддержка</div>
                        <div className="space-y-2.5">
                            {footerLinks.support.map(l => (
                                <a key={l.href} href={l.href} className="block text-[13px] text-white/60 hover:text-white transition-colors">{l.label}</a>
                            ))}
                        </div>
                    </div>

                    {/* Юридическое */}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-4">Документы</div>
                        <div className="space-y-2.5">
                            {footerLinks.legal.map(l => (
                                <Link key={l.href} href={l.href} className="block text-[13px] text-white/60 hover:text-white transition-colors">{l.label}</Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[12px] text-white/40">© 2026 КОМПАС. Все права защищены.</p>
                    <div className="flex items-center gap-4">
                        <a href="https://t.me/psy_notebook" target="_blank" rel="noopener noreferrer" className="text-[12px] text-white/40 hover:text-white/70 transition-colors">Telegram</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
