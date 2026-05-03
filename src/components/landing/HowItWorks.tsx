import { Send, CalendarDays, Bell, StickyNote } from 'lucide-react';

const steps = [
    {
        num: '1',
        title: 'Психолог отправляет ссылку',
        icon: Send,
        mockup: (
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4">
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
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4">
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
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4">
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
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4">
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
        <section id="how-it-works" className="py-14 md:py-16 bg-white">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                {/* Header */}
                <div className="text-center mb-8 md:mb-10">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Как работает первая запись
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[520px] mx-auto leading-[1.6]">
                        От настройки до первой записи клиента — четыре шага.
                    </p>
                </div>

                {/* Steps as connected flow */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {steps.map((step, idx) => (
                        <div key={step.num} className="relative group">
                            {/* Connector line (desktop) */}
                            {idx < 3 && (
                                <div className="hidden lg:block absolute top-[28px] -right-2 w-4 h-[2px] bg-[#E4E9E3] z-10" />
                            )}
                            <div className="bg-[#F7F8F4] rounded-[22px] p-5 h-full border border-transparent hover:border-[#E4E9E3] hover:shadow-card transition-all duration-300">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-forest-800 flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                                        {step.num}
                                    </div>
                                    <step.icon className="w-4 h-4 text-[#5F6C64]" />
                                </div>
                                <h3 className="text-[14px] font-bold text-[#142018] leading-snug mb-3">
                                    {step.title}
                                </h3>
                                {step.mockup}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
