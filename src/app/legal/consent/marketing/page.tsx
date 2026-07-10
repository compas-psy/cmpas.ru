import type { Metadata } from 'next';
import Link from 'next/link';

const OPERATOR_EMAIL = 'eliah.n.martynov@gmail.com';

export const metadata: Metadata = {
    title: 'Согласие на получение рекламных сообщений — CMPAS',
    description: 'Согласие на получение рекламных сообщений CMPAS, версия 2.0 от 01 сентября 2025 года.',
};

export default function MarketingConsentPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>

                <h1 className="text-3xl font-bold text-primary mb-2">Согласие на получение рекламных сообщений</h1>
                <p className="text-sm text-muted-foreground mb-2">Редакция от 01 сентября 2025 года</p>
                <p className="text-sm text-muted-foreground mb-8">Версия 2.0</p>

                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">1. Общие положения</h2>
                        <p>1.1. Настоящее Согласие (далее — «Согласие») регулирует порядок получения рекламных сообщений от онлайн-сервиса CMPAS, принадлежащего индивидуальному предпринимателю, ОГРНИП {'{{ОГРНИП}}'}, ИНН {'{{ИНН}}'}, адрес электронной почты <a href={`mailto:${OPERATOR_EMAIL}`} className="text-primary hover:underline">{OPERATOR_EMAIL}</a> (далее — «Оператор»).</p>
                        <p>1.2. Согласие предоставляется добровольно и отдельно от согласия на обработку персональных данных. Отказ от данного Согласия не ограничивает использование Сервиса.</p>
                        <p>1.3. Рекламные сообщения направляются CMPAS только при наличии действующего Согласия, оформленного в соответствии со статьёй 18 Федерального закона № 38-ФЗ «О рекламе».</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">2. Объём и каналы рассылки</h2>
                        <p>2.1. Согласие распространяется на получение следующих видов рекламной информации:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>уведомления о новых функциях и возможностях CMPAS;</li>
                            <li>предложения об участии в вебинарах, обучающих программах, акциях;</li>
                            <li>новости и рекомендации, связанные с деятельностью CMPAS и партнёров.</li>
                        </ul>
                        <p>2.2. Рекламные сообщения могут направляться по следующим каналам связи:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>электронная почта (e-mail);</li>
                            <li>Telegram-уведомления;</li>
                            <li>push-уведомления в Telegram MiniApp CMPAS;</li>
                            <li>SMS-сообщения (в случае предоставления номера телефона).</li>
                        </ul>
                        <p>2.3. CMPAS не направляет SMS-рекламу без отдельного подтверждения Клиента.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">3. Порядок оформления согласия</h2>
                        <p>3.1. Согласие предоставляется одним из способов:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>установлением чек-бокса «Согласен(на) на получение рекламных сообщений CMPAS» при регистрации или в профиле;</li>
                            <li>нажатием кнопки «Получать новости CMPAS» в интерфейсе Telegram MiniApp;</li>
                            <li>подпиской на рассылку по ссылке CMPAS, где содержится активное действие пользователя.</li>
                        </ul>
                        <p>3.2. Согласие фиксируется в системе CMPAS в журнале обработки персональных данных с указанием:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>идентификатора пользователя;</li>
                            <li>времени и даты предоставления согласия;</li>
                            <li>способа подтверждения;</li>
                            <li>версии настоящего документа.</li>
                        </ul>
                        <p>3.3. Согласие не может быть получено путём предварительно отмеченного чек-бокса или без явного действия пользователя.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">4. Отзыв согласия</h2>
                        <p>4.1. Пользователь вправе в любой момент отозвать согласие, выполнив одно из действий:</p>
                        <ul className="list-disc ml-6 space-y-1">
                            <li>снять отметку в профиле CMPAS;</li>
                            <li>отправить сообщение в Telegram-бот CMPAS с командой «Отписаться»;</li>
                            <li>перейти по ссылке «Отписаться» внизу любого рекламного письма;</li>
                            <li>направить запрос на электронный адрес <a href={`mailto:${OPERATOR_EMAIL}`} className="text-primary hover:underline">{OPERATOR_EMAIL}</a>.</li>
                        </ul>
                        <p>4.2. После отзыва согласия CMPAS прекращает рассылку рекламных сообщений в течение 24 часов, за исключением сообщений, находящихся в стадии отправки.</p>
                        <p>4.3. Отзыв Согласия не влияет на законность обработки персональных данных, осуществлявшейся до момента отзыва.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">5. Условия обработки и хранения данных</h2>
                        <p>5.1. Персональные данные, используемые для рассылок (адрес электронной почты, номер телефона, Telegram ID), обрабатываются в соответствии с <Link href="/legal/privacy" className="text-primary hover:underline">Политикой конфиденциальности</Link>.</p>
                        <p>5.2. CMPAS не передаёт данные третьим лицам для целей рекламы без отдельного письменного согласия субъекта данных.</p>
                        <p>5.3. Хранение информации о согласии осуществляется до момента его отзыва, после чего сведения удаляются из системы CMPAS.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">6. Ответственность сторон</h2>
                        <p>6.1. CMPAS несёт ответственность за соблюдение требований ФЗ-38 в части рассылки рекламы.</p>
                        <p>6.2. Пользователь обязан предоставлять достоверные контактные данные и своевременно отзывать согласие, если не желает получать рекламу.</p>
                        <p>6.3. CMPAS не несёт ответственности за задержки в доставке сообщений, вызванные действиями операторов связи или техническими сбоями.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">7. Заключительные положения</h2>
                        <p>7.1. Настоящее Согласие является публичным документом и доступно для ознакомления по адресу: <a href="https://cmpas.ru/legal/consent/marketing" className="text-primary hover:underline">cmpas.ru/legal/consent/marketing</a>.</p>
                        <p>7.2. CMPAS ведёт учёт всех предоставленных и отозванных согласий в Журнале обработки персональных данных.</p>
                        <p>7.3. Настоящее Согласие вступает в силу с момента его предоставления Пользователем и действует до момента отзыва.</p>
                    </section>

                    <div className="mt-12 pt-6 border-t border-border text-sm">
                        <p>Дата вступления в силу: 01 сентября 2025 года</p>
                        <p>Актуальная версия: <a href="https://cmpas.ru/legal/consent/marketing" className="text-primary hover:underline">cmpas.ru/legal/consent/marketing</a></p>
                    </div>
                </div>
            </div>
        </main>
    );
}
