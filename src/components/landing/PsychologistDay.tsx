import { Sun, User, StickyNote, Moon } from 'lucide-react';

const cards = [
    {
        time: '08:00',
        icon: Sun,
        title: 'Утро: сегодня 3 сессии',
        mockup: (
            <div className="mt-4 space-y-2">
                {[
                    { time: '09:00', name: 'Анна П.', format: 'Онлайн' },
                    { time: '11:00', name: 'Алексей В.', format: 'Очно' },
                    { time: '19:00', name: 'Мария Смирнова', format: 'Онлайн' },
                ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-[#E4E9E3] px-3.5 py-2.5">
                        <span className="text-[12px] font-semibold text-[#5F6C64] tabular-nums w-10">{s.time}</span>
                        <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-semibold text-[#142018] block truncate">{s.name}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            s.format === 'Онлайн' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>{s.format}</span>
                    </div>
                ))}
                <div className="text-center pt-1">
                    <span className="text-[11px] font-medium text-forest-800 cursor-pointer hover:underline">Открыть календарь →</span>
                </div>
            </div>
        ),
    },
    {
        time: '14:30',
        icon: User,
        title: 'Перед встречей: карточка клиента',
        mockup: (
            <div className="mt-4 bg-white rounded-xl border border-[#E4E9E3] p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-forest-800 text-[12px] font-bold">МС</div>
                    <div>
                        <div className="text-[14px] font-bold text-[#142018]">Мария Смирнова</div>
                        <div className="text-[11px] text-[#5F6C64]">6 сессий · Активная</div>
                    </div>
                </div>
                <div className="space-y-1.5 text-[12px] text-[#5F6C64]">
                    <div>Запрос: <span className="text-[#142018] font-medium">тревожность, самооценка</span></div>
                    <div>Последняя сессия: <span className="text-[#142018] font-medium">15 мая</span></div>
                </div>
                <div className="mt-3 text-center py-1.5 border border-[#E4E9E3] rounded-lg text-[11px] font-semibold text-forest-800 cursor-pointer hover:bg-sage-50 transition-colors">
                    Открыть карточку
                </div>
            </div>
        ),
    },
    {
        time: '15:00',
        icon: StickyNote,
        title: 'После сессии: заметка',
        mockup: (
            <div className="mt-4 bg-white rounded-xl border border-[#E4E9E3] p-4">
                <div className="text-[12px] font-semibold text-[#142018] mb-2">Новая заметка</div>
                <div className="bg-sage-50 rounded-lg p-3 text-[12px] text-[#5F6C64] leading-snug min-h-[56px] mb-3">
                    Обсудили тревогу и телесные реакции. Практика дыхания, наблюдение за ощущениями...
                </div>
                <div className="text-center py-2 bg-forest-800 text-white rounded-xl text-[12px] font-semibold">Сохранить</div>
            </div>
        ),
    },
    {
        time: '21:00',
        icon: Moon,
        title: 'Вечер: день закрыт',
        mockup: (
            <div className="mt-4 bg-white rounded-xl border border-[#E4E9E3] p-4">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Проведено', value: '3', sub: 'сессии' },
                        { label: 'Новых', value: '1', sub: 'клиент' },
                        { label: 'Заметок', value: '3', sub: 'создано' },
                        { label: 'Завтра', value: '2', sub: 'встречи' },
                    ].map((s, i) => (
                        <div key={i} className="text-center py-2.5 bg-sage-50 rounded-xl">
                            <div className="text-[20px] font-bold text-forest-800">{s.value}</div>
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
        <section id="psychologist-day" className="py-24 md:py-32 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                {/* Header */}
                <div className="text-center mb-14 md:mb-16">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Рабочий день психолога
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[480px] mx-auto leading-[1.6]">
                        КОМПАС помогает не забыть важное до, во&nbsp;время и&nbsp;после сессии.
                    </p>
                </div>

                {/* Cards 2×2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    {cards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.time} className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-7 hover:shadow-card transition-shadow duration-300">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center">
                                        <Icon className="w-4.5 h-4.5 text-forest-800" />
                                    </div>
                                    <span className="text-[12px] font-bold text-[#5F6C64] uppercase tracking-wider tabular-nums">{card.time}</span>
                                </div>
                                <h3 className="text-[16px] font-bold text-[#142018] leading-snug">
                                    {card.title}
                                </h3>
                                {card.mockup}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
