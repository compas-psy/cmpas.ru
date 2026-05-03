import { ShieldCheck, Eye, Lock, FileText } from 'lucide-react';

const items = [
    {
        icon: ShieldCheck,
        title: 'Согласия',
        desc: 'Клиент принимает согласие перед записью.',
    },
    {
        icon: Eye,
        title: 'Приватные заметки',
        desc: 'Рабочие мысли психолога не смешиваются с резюме для клиента.',
    },
    {
        icon: Lock,
        title: 'Контроль',
        desc: 'Вы управляете тем, что видит клиент и что остаётся только у вас.',
    },
    {
        icon: FileText,
        title: 'Документы',
        desc: 'Шаблоны и юридически важные материалы рядом с практикой.',
    },
];

export default function Security() {
    return (
        <section id="security" className="py-16 md:py-20 bg-white relative">
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#F7F8F4] to-transparent pointer-events-none" />
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">
                    {/* Text */}
                    <div className="lg:max-w-[400px] shrink-0">
                        <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-4">
                            Безопасность и&nbsp;доверие
                        </h2>
                        <p className="text-[15px] md:text-[16px] leading-[1.6] text-[#5F6C64]">
                            Данные клиентов требуют аккуратности. В&nbsp;КОМПАСЕ предусмотрены согласия, приватные заметки, контроль доступа и&nbsp;понятная логика обработки данных.
                        </p>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 w-full">
                        {items.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="bg-[#F7F8F4] rounded-[20px] border border-[#E4E9E3]/60 p-5 md:p-6">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 shadow-[0_2px_8px_rgba(20,32,24,0.04)]">
                                        <Icon className="w-5 h-5 text-forest-800" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-[15px] font-bold text-[#142018] mb-1.5">{item.title}</h3>
                                    <p className="text-[13px] leading-[1.5] text-[#5F6C64]">{item.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
