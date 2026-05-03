import { MessageSquare, Link2, Bell, StickyNote, Star } from 'lucide-react';

export default function BeforeAfter() {
    return (
        <section className="py-24 md:py-32 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">
                    {/* Text left */}
                    <div className="lg:max-w-[420px] flex-shrink-0">
                        <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-4">
                            Один сценарий вместо десятка сообщений
                        </h2>
                        <p className="text-[15px] md:text-[16px] leading-[1.6] text-[#5F6C64]">
                            Мы объединяем всё, что обычно происходит в&nbsp;переписке, в&nbsp;один простой и&nbsp;спокойный сценарий: ссылка, выбор времени, напоминание и&nbsp;заметка после сессии.
                        </p>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                        {/* Before */}
                        <div className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-7">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6C64] mb-5">До КОМПАСА</div>
                            <div className="space-y-4">
                                {[
                                    { icon: MessageSquare, text: 'Запись в чатах и мессенджерах' },
                                    { icon: Bell, text: 'Напоминания вручную' },
                                    { icon: StickyNote, text: 'Заметки в разных местах' },
                                    { icon: Link2, text: 'Теряются детали' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[#F2F4EF] flex items-center justify-center shrink-0 mt-0.5">
                                            <item.icon className="w-4 h-4 text-[#5F6C64]" />
                                        </div>
                                        <span className="text-[14px] font-medium text-[#5F6C64] leading-snug pt-1.5">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* After */}
                        <div className="bg-white rounded-[24px] border-2 border-[#CC9E50]/25 p-6 md:p-7 relative overflow-hidden">
                            {/* Gold accent corner */}
                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#CC9E50]/8 to-transparent rounded-bl-[40px]" />

                            <div className="flex items-center gap-2 mb-5">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-forest-800">С КОМПАСОМ</div>
                                <Star className="w-3.5 h-3.5 text-[#CC9E50] fill-[#CC9E50]" />
                            </div>
                            <div className="space-y-4">
                                {[
                                    { icon: Link2, text: 'Одна ссылка на запись' },
                                    { icon: MessageSquare, text: 'Клиент записывается сам' },
                                    { icon: Bell, text: 'Бот напоминает автоматически' },
                                    { icon: StickyNote, text: 'Заметка после сессии' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <item.icon className="w-4 h-4 text-forest-800" />
                                        </div>
                                        <span className="text-[14px] font-semibold text-[#142018] leading-snug pt-1.5">{item.text}</span>
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
