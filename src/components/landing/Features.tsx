import { CalendarDays, Clock, Users, StickyNote, MessageSquare, FileText } from 'lucide-react';

const features = [
    { icon: CalendarDays, title: 'Запись клиентов', desc: 'Клиент сам выбирает удобное время, формат и подтверждает запись.', color: 'bg-blue-50 text-blue-600' },
    { icon: Clock, title: 'Расписание', desc: 'Рабочие дни, окна, перерывы, правила записи и синхронизация.', color: 'bg-amber-50 text-amber-600' },
    { icon: Users, title: 'Клиенты', desc: 'Карточки клиентов, история сессий и важные детали под рукой.', color: 'bg-sage-100 text-forest-800' },
    { icon: StickyNote, title: 'Заметки', desc: 'Свободные и структурные заметки после сессии, приватные записи и резюме.', color: 'bg-violet-50 text-violet-600' },
    { icon: MessageSquare, title: 'Бот-ассистент', desc: 'Telegram и MAX напоминают о новых записях, сессиях и важных действиях.', color: 'bg-sky-50 text-sky-600' },
    { icon: FileText, title: 'Документы и согласия', desc: 'Шаблоны документов и электронные согласия в одном месте.', color: 'bg-rose-50 text-rose-600' },
];

export default function Features() {
    return (
        <section id="features" className="py-14 md:py-16 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="mb-8 md:mb-10">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Возможности кабинета
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[420px] leading-[1.6]">
                        Всё, что нужно для спокойной частной практики.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((f) => {
                        const Icon = f.icon;
                        return (
                            <div key={f.title} className="bg-white rounded-[22px] border border-[#E4E9E3] p-6 hover:shadow-card transition-shadow duration-300 group">
                                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-3.5 transition-transform duration-300 group-hover:scale-110`}>
                                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-[15px] font-bold text-[#142018] mb-1.5">{f.title}</h3>
                                <p className="text-[13px] leading-[1.55] text-[#5F6C64]">{f.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
