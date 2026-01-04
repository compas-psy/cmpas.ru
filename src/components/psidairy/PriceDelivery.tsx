import Link from 'next/link';

export default function PriceDelivery() {
    return (
        <section id="доставка" className="py-20 md:py-24 bg-white">
            <div className="container mx-auto px-4 max-w-6xl">
                <h2 className="text-3xl md:text-4xl font-medium text-center mb-16 text-primary">
                    Цена и доставка
                </h2>

                <div className="grid md:grid-cols-3 gap-6 mb-16">
                    {/* Card 1: Product - Primary Border */}
                    <div className="p-8 rounded-xl border-2 border-primary bg-[#FAF8F5] flex flex-col items-start relative overflow-hidden">
                        <h3 className="text-lg font-bold text-primary mb-1">Ежедневник психолога</h3>
                        <div className="text-3xl font-medium text-accent mb-2">1 790 руб.</div>
                        <p className="text-xs text-foreground/60 mb-6">В наличии</p>

                        <Link href="#order-form" className="w-full block text-center bg-primary text-white py-3.5 rounded-lg font-medium hover:bg-primary/90 transition shadow-sm mb-3">
                            Купить
                        </Link>
                        <p className="text-[10px] text-foreground/40 text-center w-full leading-tight">
                            После оплаты пришлём подтверждение и<br />уточним детали доставки
                        </p>
                    </div>

                    {/* Card 2: Delivery */}
                    <div className="p-8 rounded-xl bg-gray-50 flex flex-col items-start border border-gray-100">
                        <h3 className="text-lg font-bold text-primary mb-4">Доставка</h3>
                        <p className="text-sm text-foreground/80 mb-6 leading-relaxed">
                            Отправляем из Москвы по России в ПВЗ Озон.
                        </p>
                        <p className="text-sm text-foreground/80 mb-8 leading-relaxed">
                            Чтобы помочь с вопросами доставки нажмите на кнопку "Помочь выбрать доставку"
                        </p>

                        <Link href="#order-form" className="w-full block text-center bg-white border border-gray-200 text-foreground py-3.5 rounded-lg font-medium hover:bg-accent hover:border-accent transition mt-auto">
                            Помочь выбрать доставку
                        </Link>
                    </div>

                    {/* Card 3: Wholesale */}
                    <div className="p-8 rounded-xl bg-gray-50 flex flex-col items-start border border-gray-100">
                        <h3 className="text-lg font-bold text-primary mb-4">Для коллег / центров</h3>
                        <p className="text-sm text-foreground/80 mb-6 leading-relaxed">
                            Нужно несколько экземпляров для центра, школы или команды?
                        </p>
                        <p className="text-sm text-foreground/80 mb-8 leading-relaxed">
                            Напишите — подскажем варианты и условия.
                        </p>

                        <Link href="#order-form" className="w-full block text-center bg-white border border-gray-200 text-foreground py-3.5 rounded-lg font-medium hover:bg-accent hover:border-accent transition mt-auto">
                            Запросить опт
                        </Link>
                    </div>
                </div>

                {/* Bottom CTA Box */}
                <div className="bg-[#FAF8F5] rounded-xl p-12 text-center border-2 border-accent">
                    <h3 className="text-xl md:text-2xl font-medium text-primary mb-3">
                        Готовы начать работу с ежедневником?
                    </h3>
                    <p className="text-sm md:text-base text-foreground/70 mb-8 max-w-2xl mx-auto">
                        Закажите сейчас и получите инструмент, который поможет структурировать вашу практику.
                    </p>
                    <Link href="#order-form" className="inline-block bg-primary text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary/90 transition shadow-sm">
                        Купить ежедневник
                    </Link>
                </div>

            </div>
        </section>
    );
}
