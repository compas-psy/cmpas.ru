'use client';

import { MessageSquare, Link2, Bell, StickyNote, Star, ArrowDown } from 'lucide-react';
import { useBeforeAfterTransition } from './useReveal';

export default function BeforeAfter() {
    const sectionRef = useBeforeAfterTransition();

    return (
        <section className="py-16 md:py-20 bg-[#F7F8F4] relative" ref={sectionRef}>
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                {/* Header */}
                <div className="text-center mb-10 md:mb-12">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Один сценарий вместо десятка сообщений
                    </h2>
                    <p className="text-[15px] md:text-[16px] leading-[1.6] text-[#5F6C64] max-w-[520px] mx-auto">
                        Мы объединяем всё, что обычно происходит в&nbsp;переписке, в&nbsp;один простой сценарий.
                    </p>
                </div>

                {/* Cards stack — Before exits, After enters */}
                <div className="relative max-w-[800px] mx-auto">
                    {/* Before card — will exit like sunset */}
                    <div className="before-card-exit mb-5">
                        <div className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-8 relative overflow-hidden">
                            {/* Faded overlay to emphasize this is the "old way" */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F7F8F4]/30 pointer-events-none" />
                            
                            <div className="flex items-center gap-3 mb-5">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6C64]">До КОМПАСА</div>
                                <div className="h-px flex-1 bg-[#E4E9E3]" />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                                {[
                                    { icon: MessageSquare, text: 'Запись в чатах и мессенджерах', sub: 'Клиент пишет «когда можно?» в Telegram' },
                                    { icon: Bell, text: 'Напоминания вручную', sub: 'Вы пишете «Не забудьте, завтра в 19:00»' },
                                    { icon: StickyNote, text: 'Заметки в разных местах', sub: 'Блокнот, заметки в телефоне, Google Docs' },
                                    { icon: Link2, text: 'Теряются детали', sub: 'Запрос клиента, дата начала, контакты' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3 py-2">
                                        <div className="w-9 h-9 rounded-xl bg-[#F2F4EF] flex items-center justify-center shrink-0">
                                            <item.icon className="w-4 h-4 text-[#5F6C64]" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[14px] font-semibold text-[#5F6C64]">{item.text}</div>
                                            <div className="text-[12px] text-[#5F6C64]/60 mt-0.5">{item.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Transition indicator */}
                    <div className="flex justify-center my-4 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-forest-800 flex items-center justify-center shadow-lg">
                            <ArrowDown className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    {/* After card — enters from below */}
                    <div className="after-card-enter mt-5">
                        <div className="bg-white rounded-[24px] border-2 border-[#CC9E50]/20 p-6 md:p-8 relative overflow-hidden shadow-card">
                            {/* Gold glow */}
                            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#CC9E50]/8 to-transparent rounded-bl-full" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-sage-100/60 to-transparent rounded-tr-full" />

                            <div className="relative">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-forest-800">С КОМПАСОМ</div>
                                        <Star className="w-3.5 h-3.5 text-[#CC9E50] fill-[#CC9E50]" />
                                    </div>
                                    <div className="h-px flex-1 bg-[#CC9E50]/15" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
                                    {[
                                        { icon: Link2, text: 'Одна ссылка на запись', sub: 'Клиент сам выбирает время и формат' },
                                        { icon: MessageSquare, text: 'Клиент записывается сам', sub: 'Без переписки и согласований' },
                                        { icon: Bell, text: 'Бот напоминает автоматически', sub: 'За 24 часа и за 1 час до сессии' },
                                        { icon: StickyNote, text: 'Заметка после сессии', sub: 'Приватная и клиентская, всё в карточке' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 py-2">
                                            <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                                                <item.icon className="w-4 h-4 text-forest-800" />
                                            </div>
                                            <div className="min-w-0">
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
            </div>
        </section>
    );
}
