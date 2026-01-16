"use client";
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-primary text-white py-8 md:py-12">
            <div className="container mx-auto px-4">

                {/* Main Text */}
                <p className="text-center text-sm md:text-[15px] font-medium mb-8 opacity-90 max-w-2xl mx-auto leading-relaxed">
                    По всем вопросам относительно заказа, оптовой закупки или доставки - напишите, поможем.
                </p>

                {/* Contacts */}
                <div className="flex flex-row justify-center items-center gap-16 md:gap-32 w-full mb-10">
                    <div className="flex flex-col gap-2 items-center">
                        <span className="opacity-50 text-[11px] font-bold">Telegram</span>
                        <a href="https://t.me/psy_notebook" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-white transition text-sm font-medium">
                            @psy_notebook
                        </a>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                        <span className="opacity-50 text-[11px] font-bold">Email</span>
                        <a href="mailto:psydiary@cmpas.ru" className="text-accent hover:text-white transition text-sm font-medium">
                            psydiary@cmpas.ru
                        </a>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="w-full border-t border-white/10 pt-8 flex flex-col items-center gap-4">
                    {/* Legal Links */}
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 text-center">
                        <Link href="#" className="text-[11px] opacity-60 hover:text-accent hover:opacity-100 transition whitespace-nowrap">Политика конфиденциальности</Link>
                        <Link href="#" className="text-[11px] opacity-60 hover:text-accent hover:opacity-100 transition whitespace-nowrap">Согласие на обработку персональных данных</Link>
                        <Link href="#" className="text-[11px] opacity-60 hover:text-accent hover:opacity-100 transition whitespace-nowrap">Согласие на получение рекламных сообщений</Link>
                    </div>

                    {/* Copyright */}
                    <div className="text-[11px] opacity-60 text-center">
                        <span>© 2025 Ежедневник психолога</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
