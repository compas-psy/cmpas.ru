import Link from 'next/link';
import Image from 'next/image';

export default function Hero() {
    return (
        <section className="bg-background pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center">

                    {/* Left Column: Image */}
                    <div className="relative aspect-[3/4] md:aspect-[4/5] rounded-lg overflow-hidden shadow-2xl order-first">
                        <Image
                            src="/images/hero.jpg"
                            alt="Ежедневник психолога на столе с гирляндой"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                        />
                    </div>

                    {/* Right Column: Content */}
                    <div className="flex flex-col justify-center space-y-8 order-last">
                        <div className="space-y-6">
                            <h1 className="text-4xl md:text-5xl font-medium text-primary leading-tight">
                                Ежедневник психолога
                            </h1>
                            <p className="text-xl text-foreground">
                                Анкета клиента, записи сессий и супервизия — в одном месте.
                            </p>
                            {/* Description updated to base size to match bullets */}
                            <p className="text-base text-foreground/80 leading-relaxed max-w-lg">
                                Разработан психологами. Является не просто ежедневником, но и элементом интерьера кабинета психолога.
                            </p>
                        </div>

                        <ul className="space-y-4">
                            {[
                                '20 анкет клиентов, каждая — на 2 страницы.',
                                'Поля для записей сессий: ФИО, дата, № сессии + много места под заметки.',
                                'Отдельный раздел «Супервизия» под случаи.',
                                'Формат А5, всего 272 страницы.',
                                'Обложка: глубокий зелёный, тиснение и лента-закладка.'
                            ].map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-base text-foreground/90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2.5 flex-shrink-0" />
                                    <span className="leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-col sm:flex-row gap-4 pt-6">
                            <Link href="#order-form" className="bg-primary text-white px-10 py-4 rounded-lg text-base font-medium hover:bg-primary/90 transition shadow-sm text-center">
                                Купить ежедневник
                            </Link>
                            <Link href="#развороты" className="bg-white border border-border text-foreground px-10 py-4 rounded-lg text-base font-medium hover:bg-muted/50 transition text-center">
                                Посмотреть развороты
                            </Link>
                        </div>

                        {/* Shipment text larger */}
                        <div className="pt-2 text-sm text-muted-foreground font-medium">
                            Отправка из Москвы по России в ПВЗ Озон
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
