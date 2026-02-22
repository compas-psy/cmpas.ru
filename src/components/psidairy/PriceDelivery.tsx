import Image from 'next/image';
import Link from 'next/link';

const OZON_URL = 'https://www.ozon.ru/product/ezhednevnik-nedatirovannyy-a5-listov-272-3514667316/?at=lRt6ENXpyuvnzpN4HOMXXZKCEq7D8lUW5Zgq3CE613gQ';

export default function PriceDelivery() {
    return (
        <section id="доставка" className="py-20 md:py-24 bg-white">
            <div className="container mx-auto px-4 max-w-6xl">
                <h2 className="text-3xl md:text-4xl font-medium text-center mb-16 text-primary">
                    Цена и доставка
                </h2>

                <div className="grid md:grid-cols-3 gap-6 mb-16">
                    {/* Card 1: Buy on Ozon */}
                    <div className="p-8 rounded-xl border-2 border-[#005bff] bg-white flex flex-col items-start relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <Image
                                src="/images/ozon_logo.svg"
                                alt="Ozon"
                                width={56}
                                height={56}
                                className="rounded-xl flex-shrink-0"
                            />
                            <div>
                                <h3 className="text-lg font-bold text-[#001a34]">Купить на Ozon</h3>
                                <p className="text-xs text-foreground/50">Официальный магазин</p>
                            </div>
                        </div>
                        <p className="text-sm text-foreground/70 mb-1">Ежедневник недатированный А5</p>
                        <p className="text-sm text-foreground/70 mb-6">272 листа · Доставка по всей России</p>

                        <a
                            href={OZON_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full block text-center bg-[#005bff] text-white py-3.5 rounded-lg font-medium hover:bg-[#004acc] transition shadow-sm mb-3"
                        >
                            Перейти на Ozon
                        </a>
                        <p className="text-[10px] text-foreground/40 text-center w-full leading-tight">
                            Безопасная оплата · Быстрая доставка<br />в ПВЗ Ozon по всей России
                        </p>
                    </div>

                    {/* Card 2: Delivery */}
                    <div className="p-8 rounded-xl bg-gray-50 flex flex-col items-start border border-gray-100">
                        <h3 className="text-lg font-bold text-primary mb-4">Доставка</h3>
                        <p className="text-sm text-foreground/80 mb-6 leading-relaxed">
                            Отправляем из Москвы по России в ПВЗ Озон.
                        </p>
                        <p className="text-sm text-foreground/80 mb-8 leading-relaxed">
                            Чтобы помочь с вопросами доставки нажмите на кнопку &quot;Помочь выбрать доставку&quot;
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
                    <a
                        href={OZON_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-primary text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary/90 transition shadow-sm"
                    >
                        Купить ежедневник
                    </a>
                </div>

            </div>
        </section>
    );
}
