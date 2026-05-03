'use client';

import { Send, CalendarDays, Bell, StickyNote } from 'lucide-react';
import { useReveal } from './useReveal';

function RevealItem({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    const ref = useReveal(0.1);
    return (
        <div ref={ref} className={`landing-reveal ${delay ? `landing-reveal-delay-${delay}` : ''}`}>
            {children}
        </div>
    );
}

const steps = [
    {
        num: '1',
        title: 'Психолог отправляет ссылку',
        icon: Send,
        mockup: (
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 mt-4">
                <div className="text-[11px] text-[#5F6C64] mb-2 font-medium">Ваша ссылка для записи</div>
                <div className="flex items-center gap-2 bg-sage-50 rounded-xl px-3 py-2.5">
                    <span className="text-[13px] font-mono text-forest-800 flex-1 truncate">cmpas.ru/book/maria</span>
                    <div className="w-7 h-7 rounded-lg bg-forest-800 flex items-center justify-center shrink-0">
                        <Send className="w-3.5 h-3.5 text-white" />
                    </div>
                </div>
            </div>
        ),
    },
    {
        num: '2',
        title: 'Клиент выбирает время',
        icon: CalendarDays,
        mockup: (
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 mt-4">
                <div className="text-[11px] font-bold text-[#5F6C64] uppercase tracking-wider mb-2">15 мая, четверг</div>
                <div className="flex gap-2 mb-2">
                    {['17:00', '18:00', '19:00'].map((t, i) => (
                        <div key={t} className={`flex-1 text-center py-2 rounded-xl text-[12px] font-semibold border ${
                            i === 2 ? 'bg-forest-800 text-white border-forest-800' : 'border-[#E4E9E3] text-[#142018]'
                        }`}>{t}</div>
                    ))}
                </div>
                <div className="text-[10px] text-[#5F6C64] text-center">50 мин · Онлайн</div>
            </div>
        ),
    },
    {
        num: '3',
        title: 'Бот напоминает',
        icon: Bell,
        mockup: (
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#229ED9] flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">T</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#142018]">Напоминание</span>
                </div>
                <div className="text-[12px] text-[#142018] leading-snug mb-3">
                    Сессия сегодня в 19:00<br/>
                    <span className="text-[#5F6C64]">Мария Смирнова</span>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1 text-center py-1.5 bg-sage-100 rounded-lg text-[11px] font-semibold text-forest-800">Буду</div>
                    <div className="flex-1 text-center py-1.5 border border-[#E4E9E3] rounded-lg text-[11px] font-semibold text-[#5F6C64]">Перенести</div>
                </div>
            </div>
        ),
    },
    {
        num: '4',
        title: 'После сессии — заметка',
        icon: StickyNote,
        mockup: (
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 mt-4">
                <div className="text-[12px] font-semibold text-[#142018] mb-2">Новая заметка</div>
                <div className="text-[11px] text-[#5F6C64] leading-snug mb-3 min-h-[36px]">
                    Что было важным в сессии?
                </div>
                <div className="h-px bg-[#E4E9E3] mb-3" />
                <div className="text-center py-2 bg-forest-800 text-white rounded-xl text-[11px] font-semibold">Сохранить</div>
            </div>
        ),
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="py-16 md:py-20 bg-white relative">
            {/* Gradient bridge from previous section */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#F7F8F4] to-white pointer-events-none" />

            <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative">
                {/* Header */}
                <div className="text-center mb-10 md:mb-12">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Как работает первая запись
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[520px] mx-auto leading-[1.6]">
                        От настройки до первой самостоятельной записи клиента — в&nbsp;несколько понятных шагов.
                    </p>
                </div>

                {/* Steps with connected line */}
                <div className="relative">
                    {/* Connecting line (desktop) */}
                    <div className="hidden lg:block absolute top-[52px] left-[calc(12.5%+16px)] right-[calc(12.5%+16px)] h-[2px]">
                        <div className="w-full h-full bg-gradient-to-r from-sage-200 via-forest-800/20 to-sage-200 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                        {steps.map((step, idx) => (
                            <RevealItem key={step.num} delay={idx + 1}>
                                <div className="bg-[#F7F8F4] rounded-[24px] p-5 md:p-6 h-full border border-[#E4E9E3]/60 hover:shadow-card hover:border-[#E4E9E3] transition-all duration-300 relative">
                                    {/* Step number + icon */}
                                    <div className="flex items-center gap-3 mb-2 relative z-10">
                                        <div className="w-9 h-9 rounded-full bg-forest-800 flex items-center justify-center text-white text-[13px] font-bold shrink-0 shadow-sm">
                                            {step.num}
                                        </div>
                                        <step.icon className="w-4.5 h-4.5 text-[#5F6C64]" />
                                    </div>
                                    <h3 className="text-[15px] font-semibold text-[#142018] leading-snug">
                                        {step.title}
                                    </h3>
                                    {step.mockup}
                                </div>
                            </RevealItem>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
