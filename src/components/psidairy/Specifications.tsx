export default function Specifications() {
    const specs = [
        {
            label: "Формат",
            value: "А5"
        },
        {
            label: "Объем",
            value: "272 страницы"
        },
        {
            label: "Структура",
            value: "личные данные психолога + 20 анкет клиентов (по 2 страницы) + записи сессий + супервизия"
        },
        {
            label: "Обложка",
            value: "глубокий зелёный + тиснение"
        },
        {
            label: "Детали",
            value: "резинка для фиксации и лента-закладка"
        }
    ];

    return (
        <section id="характеристики" className="py-20 md:py-24 bg-[#F2F2F2]">
            <div className="container mx-auto px-4 max-w-5xl">
                <h2 className="text-3xl md:text-4xl font-medium text-center mb-12 text-primary">Характеристики</h2>

                <div className="grid md:grid-cols-2 gap-6">
                    {specs.map((item, idx) => (
                        <div
                            key={idx}
                            className={`bg-white p-8 rounded-lg shadow-sm hover:shadow-md transition duration-300 ${
                                // Make the "Structure" card span 2 columns if it's the 3rd item (index 2) 
                                // or just let them flow? 
                                // Looking at current grid, 5 items. 2, 2, 1.
                                // Let's make "Structure" (index 2) span full width if we want, or just natural flow.
                                // Actually, "Structure" text is long. Let's try 2-2-1 layout where the last one spans?
                                // Or maybe content dependent. Let's span the 'Structure' or 'Details' if needed.
                                // Let's try standard grid first, maybe span the one with long text?
                                // Let's make the "Structure" card (index 2) span 2 cols on desktop to fit the text?
                                // No, "Structure" is index 2. Let's make the 3rd item span 2 cols?
                                // 0, 1
                                // 2 (Structure) -> col-span-2?
                                // 3, 4
                                idx === 2 ? 'md:col-span-2' : ''
                                }`}
                        >
                            <h3 className="text-accent font-medium mb-2">{item.label}</h3>
                            <p className="text-foreground text-lg leading-relaxed">{item.value}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
