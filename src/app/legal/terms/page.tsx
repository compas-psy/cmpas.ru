import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Пользовательское соглашение — Compas',
    description: 'Пользовательское соглашение и условия использования сервиса Compas (cmpas.ru).',
};

export default function TermsOfUsePage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>

                <h1 className="text-3xl font-bold text-primary mb-2">Пользовательское соглашение</h1>
                <p className="text-sm text-muted-foreground mb-8">Последнее обновление: 22 февраля 2026 г.</p>

                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">1. Общие положения</h2>
                        <p>Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между ИП Мартынов Е.Н. (далее — «Администрация») и пользователем сайта <strong>cmpas.ru</strong> (далее — «Сайт», «Сервис»).</p>
                        <p>Использование Сайта означает принятие настоящего Соглашения в полном объёме. Если Вы не согласны с условиями Соглашения, пожалуйста, не используйте Сайт.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">2. Предмет соглашения</h2>
                        <p>Администрация предоставляет Пользователю доступ к следующим функциям Сайта:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Заказ ежедневников и сопутствующих товаров</li>
                            <li>Личный кабинет психолога с ведением дневника сессий</li>
                            <li>Управление расписанием и клиентами</li>
                            <li>Интеграция с внешними календарями (Google Calendar, Яндекс Календарь)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">3. Регистрация и авторизация</h2>
                        <p>Для доступа к личному кабинету необходима авторизация через аккаунт Яндекс или по электронной почте.</p>
                        <p>Пользователь обязуется предоставлять достоверную информацию при регистрации и не передавать данные для входа третьим лицам.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">4. Заказ и оплата</h2>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Заказ оформляется через Сайт или через маркетплейс Ozon</li>
                            <li>Цены указаны в российских рублях</li>
                            <li>Администрация оставляет за собой право изменять цены без предварительного уведомления</li>
                            <li>Оплата производится способами, доступными на Сайте или на маркетплейсе</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">5. Доставка</h2>
                        <p>Доставка осуществляется через пункты выдачи Ozon по всей территории Российской Федерации. Сроки и стоимость доставки определяются в соответствии с условиями службы доставки.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">6. Возврат и обмен</h2>
                        <p>Возврат и обмен товаров осуществляется в соответствии с Законом РФ «О защите прав потребителей».</p>
                        <p>Для оформления возврата свяжитесь с нами по email: <a href="mailto:eliah.n.martynov@gmail.com" className="text-primary hover:underline">eliah.n.martynov@gmail.com</a></p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">7. Интеллектуальная собственность</h2>
                        <p>Все материалы Сайта (тексты, изображения, дизайн, программный код, товарные знаки) являются собственностью Администрации и защищены законодательством РФ об интеллектуальной собственности.</p>
                        <p>Копирование, распространение и иное использование материалов без письменного согласия Администрации запрещено.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">8. Ответственность</h2>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Администрация не несёт ответственности за временную недоступность Сайта вследствие технических работ</li>
                            <li>Пользователь самостоятельно несёт ответственность за сохранность своих учётных данных</li>
                            <li>Администрация не несёт ответственности за содержимое внешних сервисов, с которыми интегрируется Сайт</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">9. Конфиденциальность</h2>
                        <p>Обработка персональных данных регулируется <Link href="/legal/privacy" className="text-primary hover:underline">Политикой конфиденциальности</Link>.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">10. Изменение условий</h2>
                        <p>Администрация оставляет за собой право изменять настоящее Соглашение без предварительного уведомления. Актуальная версия доступна на данной странице. Продолжая использовать Сайт после внесения изменений, Пользователь подтверждает согласие с обновлённым Соглашением.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">11. Контакты</h2>
                        <p>По вопросам, связанным с настоящим Соглашением:</p>
                        <p>Email: <a href="mailto:eliah.n.martynov@gmail.com" className="text-primary hover:underline">eliah.n.martynov@gmail.com</a></p>
                        <p>Сайт: <a href="https://cmpas.ru" className="text-primary hover:underline">cmpas.ru</a></p>
                    </section>

                    <div className="mt-12 pt-6 border-t border-border">
                        <a
                            href="/legal/terms-of-use.pdf"
                            className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            📄 Скачать PDF-версию
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
