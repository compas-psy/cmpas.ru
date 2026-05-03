import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Политика конфиденциальности — Compas',
    description: 'Политика конфиденциальности и обработки персональных данных сервиса Compas (cmpas.ru).',
};

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>

                <h1 className="text-3xl font-bold text-primary mb-2">Политика конфиденциальности</h1>
                <p className="text-sm text-muted-foreground mb-8">Последнее обновление: 22 февраля 2026 г.</p>

                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">1. Общие положения</h2>
                        <p>Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки и защиты персональных данных пользователей сайта <strong>cmpas.ru</strong> (далее — «Сайт»), принадлежащего ИП Мартынов И.Н. (далее — «Оператор», «Мы»).</p>
                        <p>Используя Сайт и предоставляя свои персональные данные, Вы соглашаетесь с условиями настоящей Политики.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">2. Какие данные мы собираем</h2>
                        <p>Мы можем собирать следующие персональные данные:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Имя и фамилия</li>
                            <li>Номер телефона</li>
                            <li>Адрес электронной почты</li>
                            <li>Данные, предоставляемые при авторизации через Яндекс</li>
                            <li>Данные об использовании Сайта (cookies, IP-адрес, информация о браузере)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">3. Цели обработки данных</h2>
                        <p>Мы обрабатываем персональные данные в следующих целях:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Обработка заказов и доставка товаров</li>
                            <li>Связь с пользователем для подтверждения заказа</li>
                            <li>Предоставление доступа к личному кабинету и сервисам Сайта</li>
                            <li>Синхронизация с внешними календарями (Google Calendar, Яндекс Календарь) по запросу пользователя</li>
                            <li>Улучшение работы Сайта и качества обслуживания</li>
                            <li>Исполнение требований законодательства РФ</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">4. Защита данных</h2>
                        <p>Мы принимаем необходимые и достаточные организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения, а также от иных неправомерных действий с ними третьих лиц.</p>
                        <p>Доступ к персональным данным имеют только уполномоченные сотрудники. Данные хранятся на защищённых серверах с шифрованием.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">5. Передача данных третьим лицам</h2>
                        <p>Мы не передаём персональные данные третьим лицам, за исключением случаев:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Когда передача необходима для исполнения заказа (служба доставки)</li>
                            <li>Когда пользователь явно дал согласие на интеграцию с внешними сервисами (Google, Яндекс)</li>
                            <li>По требованию законодательства РФ</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">6. Cookies</h2>
                        <p>Сайт использует файлы cookies для обеспечения корректной работы, авторизации пользователей и сбора аналитических данных. Вы можете отключить cookies в настройках браузера, однако это может повлиять на функциональность Сайта.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">7. Права пользователя</h2>
                        <p>Вы имеете право:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>Получить информацию о своих персональных данных, которые мы обрабатываем</li>
                            <li>Потребовать уточнения, блокирования или уничтожения своих данных</li>
                            <li>Отозвать согласие на обработку персональных данных</li>
                            <li>Отключить интеграции с внешними сервисами в личном кабинете</li>
                        </ul>
                        <p className="mt-2">Для реализации своих прав свяжитесь с нами по email: <a href="mailto:eliah.n.martynov@gmail.com" className="text-primary hover:underline">eliah.n.martynov@gmail.com</a></p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">8. Изменение Политики</h2>
                        <p>Мы оставляем за собой право вносить изменения в настоящую Политику. Актуальная версия размещена на данной странице.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">9. Контакты</h2>
                        <p>По вопросам обработки персональных данных:</p>
                        <p>Email: <a href="mailto:eliah.n.martynov@gmail.com" className="text-primary hover:underline">eliah.n.martynov@gmail.com</a></p>
                        <p>Сайт: <a href="https://cmpas.ru" className="text-primary hover:underline">cmpas.ru</a></p>
                    </section>

                    <div className="mt-12 pt-6 border-t border-border">
                        <a
                            href="/legal/privacy-policy.pdf"
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
