import Link from 'next/link';

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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="15.55 13.39 200 200" className="w-14 h-14 flex-shrink-0" aria-label="Ozon">
                                <defs>
                                    <clipPath id="ozon-clip"><rect x="15.55" y="13.39" width="200" height="200" rx="40" ry="40" /></clipPath>
                                </defs>
                                <g clipPath="url(#ozon-clip)">
                                    <rect fill="#005bff" x="15.55" y="13.39" width="200" height="200" rx="40" ry="40" />
                                    <g>
                                        <path fill="#f1117e" d="M772.17-196.78c-.56-.09-3.25.56-5.02,1.76-15.89,10.68-36.97,35.3-65.49,63.63-16.35,16.26-35.12,33.81-56.48,50.63-12.43,9.73-25.74,18.21-39.85,25.27C512.42-8.76,468.2,8.98,428.63,41.13c-2.36,1.92-5.03,3.31-7.71,4.74-32.7,15.14-69.4,49.33-95.5,77.29-14.59,15.7-25.83,29.35-31.21,36.78-15.33,21.36-44.22,76.17-87.7,125.78-30.83,35.24-63.46,61.28-101.67,83.77h65.22c21.81-11.99,42.02-24.14,55.31-34.9,3.44-2.79,6.41-5.57,8.92-8.17,7.62-8.08,17-22.66,26.1-40.69,18.12-35.76,39.02-84.63,65.03-119.83h0c12.91-17.56,27.03-31.68,42.55-38.92,1.86-.47,3.53.83,3.53,2.69-5.95,26.38-29.17,48.03-46.08,65.96-12.63,13.38-22.3,25.08-18.11,31.58,4.21,6.31,14.5-3.82,18.11-7.43,24.89-21.46,66.33-79.24,95.22-104.14,4.4-3.77,10.78-10.69,14.86-14.77,17.18-19.69,28.33-36.69,50.35-56.29,63.35-56.48,98.1-55.92,167.31-110.17,29.17-22.85,54.72-45.8,74.97-65.77,29.54-29.26,47.38-52.49,47.19-61.5,0-2.14-1.02-3.44-3.16-3.9Z" />
                                        <path fill="#f1117e" d="M61.95,10.65h0c18.12-14.67,122.91-60.37,163.41-93.17,3.44-2.79,6.41-5.57,8.92-8.17,7.62-8.08,17-22.66,26.1-40.69,18.11-35.76,39.02-84.63,65.03-119.83,12.91-17.56,27.03-31.68,42.55-38.92,1.86-.47,3.53.83,3.53,2.69-5.95,26.38-29.17,48.03-46.08,65.96-12.63,13.38-22.3,25.08-18.11,31.58,4.21,6.31,14.5-3.82,18.11-7.43,24.89-21.46,66.33-79.24,95.22-104.14,4.4-3.77,10.78-10.69,14.86-14.77,17.18-19.69,28.33-36.69,50.35-56.29,63.35-56.48,98.1-55.92,167.31-110.17,29.17-22.85,54.72-45.8,74.97-65.77,29.54-29.26,47.38-52.49,47.19-61.5,0-2.14-1.02-3.44-3.16-3.9-.56-.09-3.25.56-5.02,1.76-15.89,10.68-36.97,35.3-65.49,63.63-16.35,16.26-35.12,33.81-56.48,50.63-12.43,9.73-25.74,18.21-39.85,25.27-92.9,46.72-137.12,64.47-176.69,96.61-2.36,1.92-5.03,3.31-7.71,4.74-32.7,15.14-69.4,49.33-95.5,77.29-14.59,15.7-25.83,29.35-31.21,36.78-15.33,21.36-44.22,76.17-87.7,125.78C166.69-85.88,123.9-55.71,69.94-28.73,28.51-10.71,12.07,9.07-31.41,44.47c-6.9,5.58-12.91,10.87-20.53,17.56,0,0-.09,0-.09.09-12.63,11.11-24.85,22.66-37.03,34.25v24.07C-37.92,84.22,3.19,67.18,26.92,47.9c13.01-10.84,21.68-26.44,35.02-37.25Z" />
                                    </g>
                                    <g>
                                        <path fill="#fff" d="M44.34,140.52c.74,5.46-2.39,10.88-7.52,12.97-7.51,3.07-15.84-1.72-16.93-9.74-.74-5.46,2.39-10.88,7.52-12.97,7.52-3.06,15.84,1.72,16.93,9.74ZM28.46,119.39c-14.49,2.39-23.11,17.27-17.94,30.97,3.82,10.13,14.53,16.29,25.26,14.53,14.49-2.39,23.11-17.27,17.94-30.97-3.83-10.13-14.53-16.29-25.26-14.53Z" />
                                        <path fill="#fff" d="M99.23,135.81l-17.92,4.8,14.92-35.86c.49-1.19-.6-2.41-1.85-2.08l-33.07,8.86c-3.26.87-5.05,4.49-3.49,7.65,1.15,2.31,3.93,3.36,6.47,2.68l14.71-3.94-14.92,35.89c-.49,1.18.6,2.39,1.84,2.06l35.92-9.63c2.53-.68,4.42-2.97,4.26-5.56-.22-3.52-3.58-5.76-6.86-4.88Z" />
                                        <path fill="#fff" d="M212.63,76.55c-.87-3.24-4.55-4.97-7.78-3.36-2.31,1.16-3.39,3.85-2.73,6.31l4.63,17.29-34.51-14.64c-1.2-.51-2.48.58-2.15,1.83l9.56,35.69c.66,2.46,2.94,4.25,5.52,4.1,3.6-.21,5.92-3.56,5.06-6.8l-4.67-17.44,34.51,14.65c1.2.51,2.48-.58,2.15-1.83l-9.6-35.82Z" />
                                        <path fill="#fff" d="M139.42,126.1c-12.07,3.23-22.77-.62-24.27-6.21-1.5-5.6,5.84-14.28,17.91-17.51,12.07-3.23,22.77.62,24.27,6.21s-5.84,14.28-17.91,17.51ZM130.28,92c-17.47,4.68-28.96,18.43-25.66,30.72,3.29,12.29,20.12,18.45,37.58,13.77,17.47-4.68,28.96-18.43,25.66-30.72-3.29-12.28-20.12-18.45-37.58-13.77Z" />
                                    </g>
                                </g>
                            </svg>
                            <div>
                                <h3 className="text-lg font-bold text-[#001a34]">Купить на Ozon</h3>
                                <p className="text-xs text-foreground/50">Официальный магазин</p>
                            </div>
                        </div>
                        <p className="text-sm text-foreground/70 mb-1">Ежедневник недатированный А5</p>
                        <p className="text-sm text-foreground/70 mb-6">272 листа · Доставка по всей России</p>

                        <a
                            href="https://www.ozon.ru/product/ezhednevnik-nedatirovannyy-a5-listov-272-3514667316/?at=lRt6ENXpyuvnzpN4HOMXXZKCEq7D8lUW5Zgq3CE613gQ"
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
