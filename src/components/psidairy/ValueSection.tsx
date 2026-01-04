export default function ValueSection() {
    return (
        <section className="py-20 md:py-24 bg-[#F2F2F2]">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl md:text-4xl font-medium mb-12 text-primary max-w-4xl mx-auto leading-tight">
                    Когда в практике появляется порядок — становится спокойнее
                </h2>

                <div className="max-w-3xl mx-auto space-y-6 text-base md:text-lg text-foreground/80 mb-16 leading-relaxed">
                    <p>
                        Записи перестают жить в заметках телефона, отдельных листах и
                        &quot;где-то в мессенджере&quot;. Всё собирается в одну понятную систему.
                    </p>
                    <p>
                        Анкета клиента помогает аккуратно собрать базовую информацию и
                        контекст — особенно на старте работы.
                    </p>
                    <p>
                        Записи сессий становятся одинаковыми по структуре: легко найти
                        нужный момент, восстановить ход работы и увидеть динамику.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto text-left">
                    {/* Card 1 */}
                    <div className="p-8 bg-white rounded-lg shadow-sm hover:shadow-md transition duration-300 h-full">
                        <h3 className="font-medium text-xl mb-3 text-primary">Меньше суеты</h3>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                            всё важное под рукой, без поиска &quot;где записано&quot;.
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="p-8 bg-white rounded-lg shadow-sm hover:shadow-md transition duration-300 h-full">
                        <h3 className="font-medium text-xl mb-3 text-primary">Больше ясности</h3>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                            единый формат сессий и заметок.
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="p-8 bg-white rounded-lg shadow-sm hover:shadow-md transition duration-300 h-full">
                        <h3 className="font-medium text-xl mb-3 text-primary">Поддержка специалиста</h3>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                            отдельное место для супервизии и случаев.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
