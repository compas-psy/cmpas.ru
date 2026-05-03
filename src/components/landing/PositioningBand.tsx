import { MessageSquareOff, BookOpen, Lightbulb } from 'lucide-react';

const points = [
    {
        icon: MessageSquareOff,
        title: 'Меньше переписки',
        desc: 'Клиент записывается сам, бот берёт напоминания на себя.',
    },
    {
        icon: BookOpen,
        title: 'Меньше забытых деталей',
        desc: 'История, заметки и документы рядом с карточкой клиента.',
    },
    {
        icon: Lightbulb,
        title: 'Больше ясности в практике',
        desc: 'Видно день, клиентов, сессии и следующие шаги.',
    },
];

export default function PositioningBand() {
    return (
        <section className="py-20 md:py-28 relative overflow-hidden" style={{
            background: 'radial-gradient(circle at 80% 20%, rgba(204, 158, 80, 0.16), transparent 34%), linear-gradient(135deg, #143D2F 0%, #1D4735 55%, #285B46 100%)',
        }}>
            <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative z-10">
                <div className="text-center mb-12 md:mb-14">
                    <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.12] tracking-[-0.015em] text-white mb-4">
                        Не&nbsp;CRM. Не&nbsp;таблица.<br />
                        <span className="text-white/80">Рабочее пространство</span>
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-white/60 max-w-[520px] mx-auto leading-[1.6]">
                        КОМПАС убирает рутину вокруг практики, чтобы у&nbsp;психолога оставалось больше внимания на&nbsp;контакт с&nbsp;клиентом.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                    {points.map((p) => {
                        const Icon = p.icon;
                        return (
                            <div key={p.title} className="bg-white/8 backdrop-blur-sm rounded-[24px] border border-white/10 p-6 md:p-7">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                                    <Icon className="w-5 h-5 text-white/80" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-[16px] font-bold text-white mb-2">{p.title}</h3>
                                <p className="text-[14px] leading-[1.55] text-white/60">{p.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
