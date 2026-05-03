'use client';

import { MessageSquare, Link2, Bell, StickyNote, Star, ArrowRight } from 'lucide-react';

export default function BeforeAfter() {
    return (
        <section className="py-14 md:py-16 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                {/* Header */}
                <div className="text-center mb-8 md:mb-10">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Один сценарий вместо десятка сообщений
                    </h2>
                    <p className="text-[15px] md:text-[16px] leading-[1.6] text-[#5F6C64] max-w-[520px] mx-auto">
                        Всё, что обычно происходит в&nbsp;переписке — в&nbsp;одном простом сценарии.
                    </p>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-[900px] mx-auto items-stretch relative">
                    {/* Arrow connector (desktop) */}
                    <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="w-10 h-10 rounded-full bg-forest-800 flex items-center justify-center shadow-lg">
                            <ArrowRight className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    {/* Before */}
                    <div className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-7 relative">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6C64]">До КОМПАСА</div>
                        </div>
                        <div className="space-y-3.5">
                            {[
                                { icon: MessageSquare, text: 'Запись в чатах и мессенджерах', sub: 'Клиент пишет «когда можно?»' },
                                { icon: Bell, text: 'Напоминания вручную', sub: '«Не забудьте, завтра в 19:00»' },
                                { icon: StickyNote, text: 'Заметки в разных местах', sub: 'Блокнот, телефон, Google Docs' },
                                { icon: Link2, text: 'Теряются детали', sub: 'Запрос, дата начала, контакты' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#F2F4EF] flex items-center justify-center shrink-0 mt-0.5">
                                        <item.icon className="w-4 h-4 text-[#5F6C64]" />
                                    </div>
                                    <div>
                                        <div className="text-[14px] font-medium text-[#5F6C64]">{item.text}</div>
                                        <div className="text-[12px] text-[#5F6C64]/50 mt-0.5">{item.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Fade overlay to show this is "old" */}
                        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-transparent via-transparent to-white/40 pointer-events-none" />
                    </div>

                    {/* After */}
                    <div className="bg-white rounded-[24px] border-2 border-[#CC9E50]/20 p-6 md:p-7 relative overflow-hidden shadow-card">
                        {/* Gold accent glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#CC9E50]/8 to-transparent rounded-bl-full" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-sage-100/60 to-transparent rounded-tr-full" />

                        <div className="relative">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-forest-800">С КОМПАСОМ</div>
                                <Star className="w-3.5 h-3.5 text-[#CC9E50] fill-[#CC9E50]" />
                            </div>
                            <div className="space-y-3.5">
                                {[
                                    { icon: Link2, text: 'Одна ссылка на запись', sub: 'Клиент сам выбирает время' },
                                    { icon: MessageSquare, text: 'Клиент записывается сам', sub: 'Без переписки и согласований' },
                                    { icon: Bell, text: 'Бот напоминает автоматически', sub: 'За 24ч и за 1ч до сессии' },
                                    { icon: StickyNote, text: 'Заметка после сессии', sub: 'Приватная и клиентская' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <item.icon className="w-4 h-4 text-forest-800" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-[#142018]">{item.text}</div>
                                            <div className="text-[12px] text-[#5F6C64] mt-0.5">{item.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
