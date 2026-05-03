'use client';

import { CalendarDays, Clock, Users, StickyNote, MessageSquare, FileText } from 'lucide-react';
import { useReveal } from './useReveal';

function RevealCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    const ref = useReveal(0.1);
    return (
        <div ref={ref} className={`landing-reveal ${delay ? `landing-reveal-delay-${delay}` : ''}`}>
            {children}
        </div>
    );
}

const features = [
    {
        icon: CalendarDays,
        title: 'Запись клиентов',
        desc: 'Клиент сам выбирает удобное время, формат и подтверждает запись.',
        color: 'bg-blue-50 text-blue-600',
    },
    {
        icon: Clock,
        title: 'Расписание',
        desc: 'Рабочие дни, окна, перерывы, правила записи и синхронизация.',
        color: 'bg-amber-50 text-amber-600',
    },
    {
        icon: Users,
        title: 'Клиенты',
        desc: 'Карточки клиентов, история сессий и важные детали под рукой.',
        color: 'bg-sage-100 text-forest-800',
    },
    {
        icon: StickyNote,
        title: 'Заметки',
        desc: 'Свободные и структурные заметки после сессии, приватные записи и резюме.',
        color: 'bg-violet-50 text-violet-600',
    },
    {
        icon: MessageSquare,
        title: 'Бот-ассистент',
        desc: 'Telegram и MAX напоминают о новых записях, сессиях и важных действиях.',
        color: 'bg-sky-50 text-sky-600',
    },
    {
        icon: FileText,
        title: 'Документы и согласия',
        desc: 'Шаблоны документов и электронные согласия в одном месте.',
        color: 'bg-rose-50 text-rose-600',
    },
];

export default function Features() {
    return (
        <section id="features" className="py-16 md:py-20 bg-[#F7F8F4] relative">
            {/* Gradient bridge */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none" />

            <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative">
                <div className="mb-10 md:mb-12">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Возможности кабинета
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[420px] leading-[1.6]">
                        Всё, что нужно для спокойной частной практики.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {features.map((f, idx) => {
                        const Icon = f.icon;
                        const delay = (idx % 3) + 1;
                        return (
                            <RevealCard key={f.title} delay={delay}>
                                <div className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-7 hover:shadow-card-hover hover:border-[#E4E9E3] transition-all duration-300 group h-full">
                                    <div className={`w-11 h-11 rounded-2xl ${f.color} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-[16px] font-bold text-[#142018] mb-2">{f.title}</h3>
                                    <p className="text-[14px] leading-[1.55] text-[#5F6C64]">{f.desc}</p>
                                </div>
                            </RevealCard>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
