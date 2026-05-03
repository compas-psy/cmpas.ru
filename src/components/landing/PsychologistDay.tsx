import { Sun, User, StickyNote, Moon } from 'lucide-react';

const cards = [
    {
        time: '08:00',
        icon: Sun,
        title: 'Утро: сегодня 3 сессии',
        mockup: (
            <div className="mt-3 space-y-2">
                {[
                    { time: '09:00', name: 'Анна П.', format: 'Онлайн' },
                    { time: '11:00', name: 'Алексей В.', format: 'Очно' },
                    { time: '19:00', name: 'Мария Смирнова', format: 'Онлайн' },
                ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-[#E4E9E3] px-3 py-2">
                        <span className="text-[12px] font-semibold text-[#5F6C64] tabular-nums w-10">{s.time}</span>
                        <span className="text-[13px] font-semibold text-[#142018] flex-1 truncate">{s.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            s.format === 'Онлайн' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>{s.format}</span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        time: '14:30',
        icon: User,
        title: 'Перед встречей: карточка клиента',
        mockup: (
            <div className="mt-3 bg-white rounded-xl border border-[#E4E9E3] p-3.5">
                <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-forest-800 text-[11px] font-bold">МС</div>
                    <div>
                        <div className="text-[13px] font-bold text-[#142018]">Мария Смирнова</div>
                        <div className="text-[11px] text-[#5F6C64]">6 сессий · Активная</div>
                    </div>
                </div>
                <div className="text-[12px] text-[#5F6C64] space-y-1">
                    <div>Запрос: <span className="text-[#142018] font-medium">тревожность, самооценка</span></div>
                    <div>Последняя: <span className="text-[#142018] font-medium">15 мая</span></div>
                </div>
            </div>
        ),
    },
    {
        time: '15:00',
        icon: StickyNote,
        title: 'После сессии: заметка',
        mockup: (
            <div className="mt-3 bg-white rounded-xl border border-[#E4E9E3] p-3.5">
                <div className="text-[12px] font-semibold text-[#142018] mb-1.5">Новая заметка</div>
                <div className="bg-sage-50 rounded-lg p-2.5 text-[12px] text-[#5F6C64] leading-snug mb-2.5">
                    Обсудили тревогу и телесные реакции. Практика дыхания...
                </div>
                <div className="text-center py-1.5 bg-forest-800 text-white rounded-lg text-[11px] font-semibold">Сохранить</div>
            </div>
        ),
    },
    {
        time: '21:00',
        icon: Moon,
        title: 'Вечер: день закрыт',
        mockup: (
            <div className="mt-3 bg-white rounded-xl border border-[#E4E9E3] p-3.5">
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { value: '3', sub: 'сессии' },
                        { value: '1', sub: 'новый' },
                        { value: '3', sub: 'заметки' },
                        { value: '2', sub: 'завтра' },
                    ].map((s, i) => (
                        <div key={i} className="text-center py-2 bg-sage-50 rounded-lg">
                            <div className="text-[18px] font-bold text-forest-800">{s.value}</div>
                            <div className="text-[10px] text-[#5F6C64] font-medium">{s.sub}</div>
                        </div>
                    ))}
                </div>
            </div>
        ),
    },
];

export default function PsychologistDay() {
    return (
        <section id="psychologist-day" className="py-14 md:py-16 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="text-center mb-8 md:mb-10">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Рабочий день психолога
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[480px] mx-auto leading-[1.6]">
                        КОМПАС помогает не забыть важное до, во&nbsp;время и&nbsp;после сессии.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.time} className="bg-white rounded-[22px] border border-[#E4E9E3] p-5 md:p-6 hover:shadow-card transition-shadow duration-300">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center">
                                        <Icon className="w-4 h-4 text-forest-800" />
                                    </div>
                                    <span className="text-[12px] font-bold text-[#5F6C64] uppercase tracking-wider tabular-nums">{card.time}</span>
                                </div>
                                <h3 className="text-[15px] font-bold text-[#142018] leading-snug">{card.title}</h3>
                                {card.mockup}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
