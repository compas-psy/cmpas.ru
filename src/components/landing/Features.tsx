import { CalendarDays, Clock, Users, StickyNote, MessageSquare, FileText } from 'lucide-react';

const features = [
    {
        icon: CalendarDays,
        title: 'Запись клиентов',
        desc: 'Клиент сам выбирает удобное время, формат и подтверждает запись.',
    },
    {
        icon: Clock,
        title: 'Расписание',
        desc: 'Рабочие дни, окна, перерывы, правила записи и синхронизация.',
    },
    {
        icon: Users,
        title: 'Клиенты',
        desc: 'Карточки клиентов, история сессий и важные детали под рукой.',
    },
    {
        icon: StickyNote,
        title: 'Заметки',
        desc: 'Свободные и структурные заметки после сессии, приватные записи и резюме.',
    },
    {
        icon: MessageSquare,
        title: 'Бот-ассистент',
        desc: 'Telegram и MAX напоминают о новых записях, сессиях и важных действиях.',
    },
    {
        icon: FileText,
        title: 'Документы и согласия',
        desc: 'Шаблоны документов и электронные согласия в одном месте.',
    },
];

export default function Features() {
    return (
        <section id="features" className="py-24 md:py-32 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="mb-14 md:mb-16">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Возможности кабинета
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[420px] leading-[1.6]">
                        Всё, что нужно для спокойной частной практики.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                    {features.map((f) => {
                        const Icon = f.icon;
                        return (
                            <div key={f.title} className="bg-white rounded-[24px] border border-[#E4E9E3] p-6 md:p-7 hover:shadow-card transition-shadow duration-300 group">
                                <div className="w-11 h-11 rounded-2xl bg-sage-100 flex items-center justify-center mb-4 group-hover:bg-sage-150 transition-colors">
                                    <Icon className="w-5 h-5 text-forest-800" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-[16px] font-bold text-[#142018] mb-2">{f.title}</h3>
                                <p className="text-[14px] leading-[1.55] text-[#5F6C64]">{f.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
