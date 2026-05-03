'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
    {
        q: 'Это только для психологов?',
        a: 'В первую очередь — для психологов. Также подойдёт коучам, менторам и другим специалистам помогающих профессий.',
    },
    {
        q: 'Клиенту нужно устанавливать приложение?',
        a: 'Нет. Клиент может открыть ссылку или MiniApp в мессенджере.',
    },
    {
        q: 'Можно ли не показывать расписание клиентам?',
        a: 'Да. Психолог сам выбирает режим расписания и доступность записи.',
    },
    {
        q: 'Можно ли работать только через Telegram?',
        a: 'Да. Telegram и MAX можно использовать как быстрые каналы уведомлений и действий.',
    },
    {
        q: 'Что с персональными данными?',
        a: 'Клиент принимает согласие перед записью, а специалист управляет данными в своём кабинете.',
    },
    {
        q: 'Есть ли бесплатный период?',
        a: 'Да, 30 дней. Этого достаточно, чтобы настроить кабинет и провести первые записи.',
    },
];

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const mid = Math.ceil(faqs.length / 2);
    const col1 = faqs.slice(0, mid);
    const col2 = faqs.slice(mid);

    const FaqItem = ({ faq, idx }: { faq: typeof faqs[0]; idx: number }) => {
        const isOpen = openIndex === idx;
        return (
            <div className="border-b border-[#E4E9E3] last:border-b-0">
                <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-start justify-between gap-4 py-5 text-left group"
                >
                    <span className="text-[15px] font-semibold text-[#142018] leading-snug group-hover:text-forest-800 transition-colors">{faq.q}</span>
                    <ChevronDown className={`w-4.5 h-4.5 text-[#5F6C64] shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="pb-5 -mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-[14px] leading-[1.6] text-[#5F6C64]">{faq.a}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="py-16 md:py-20 bg-white">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-10 md:mb-14">
                    Частые вопросы
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 md:gap-x-16">
                    <div>
                        {col1.map((faq, i) => <FaqItem key={i} faq={faq} idx={i} />)}
                    </div>
                    <div>
                        {col2.map((faq, i) => <FaqItem key={i + mid} faq={faq} idx={i + mid} />)}
                    </div>
                </div>
            </div>
        </section>
    );
}
