import Link from 'next/link';
import { Check } from 'lucide-react';

const included = [
    'Все возможности КОМПАСА',
    'Бот и напоминания клиентам',
    'Расписание и запись',
    'Заметки и карточки клиентов',
    'Документы и согласия',
    'Поддержка и обновления',
];

export default function Pricing() {
    return (
        <section id="pricing" className="py-24 md:py-32 bg-[#F7F8F4]">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="text-center mb-12 md:mb-14">
                    <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-3">
                        Просто и прозрачно
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] max-w-[480px] mx-auto leading-[1.6]">
                        30 дней бесплатно. Этого достаточно, чтобы настроить кабинет и&nbsp;провести первые записи.
                    </p>
                </div>

                {/* Pricing card */}
                <div className="max-w-[480px] mx-auto">
                    <div className="bg-white rounded-[28px] border border-[#E4E9E3] p-7 md:p-9 shadow-card">
                        {/* Price */}
                        <div className="text-center mb-7">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-[48px] md:text-[56px] font-bold text-[#142018] tracking-tight">990</span>
                                <span className="text-[20px] font-semibold text-[#5F6C64]">₽</span>
                            </div>
                            <div className="text-[14px] text-[#5F6C64] font-medium -mt-1">в месяц, после пробного периода</div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[#E4E9E3] mb-6" />

                        {/* Features */}
                        <div className="space-y-3.5 mb-8">
                            {included.map(item => (
                                <div key={item} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                                        <Check className="w-3 h-3 text-forest-800" strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[14px] font-medium text-[#142018]">{item}</span>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <Link
                            href="/auth"
                            className="flex items-center justify-center w-full py-3.5 bg-forest-800 text-white text-[15px] font-semibold rounded-[14px] hover:bg-forest-700 transition-all active:scale-[0.97] shadow-sm"
                        >
                            Попробовать бесплатно
                        </Link>

                        <p className="text-center text-[12px] text-[#5F6C64] mt-4">
                            Без оплаты на старте · отмена в любой момент
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
