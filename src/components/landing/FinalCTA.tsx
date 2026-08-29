import Link from 'next/link';

export default function FinalCTA() {
    return (
        <section className="py-16 md:py-20 bg-sage-50">
            <div className="max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="max-w-[640px] mx-auto text-center">
                    <h2 className="text-[28px] md:text-[40px] font-bold leading-[1.12] tracking-[-0.015em] text-[#142018] mb-4">
                        Попробуйте провести первую запись через&nbsp;ПРАКТИКУ
                    </h2>
                    <p className="text-[15px] md:text-[16px] text-[#5F6C64] leading-[1.6] mb-8 max-w-[480px] mx-auto">
                        Настройте расписание, отправьте ссылку клиенту и&nbsp;посмотрите, как выглядит рабочий день без лишней переписки.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href="/auth"
                            className="inline-flex items-center justify-center px-8 py-3.5 bg-forest-800 text-white text-[15px] font-semibold rounded-[14px] hover:bg-forest-700 transition-all active:scale-[0.97] shadow-sm"
                        >
                            Создать кабинет бесплатно
                        </Link>
                        <a
                            href="#client-flow"
                            className="inline-flex items-center justify-center px-6 py-3.5 border border-[#E4E9E3] text-[15px] font-semibold text-forest-800 rounded-[14px] hover:bg-white transition-all bg-white/60"
                        >
                            Посмотреть запись клиента
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
