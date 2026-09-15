import { db } from '@/lib/db';
import { fetchStatement, reconcilePayments, type KnownPayment, type ReconciliationResult } from '@/lib/analytics/reconciliation';
import { paymentTerminals, isDemoTerminal } from '@/lib/tinkoff';

/**
 * ЕЖЕДНЕВНАЯ СВЕРКА С ВЫПИСКОЙ БАНКА — ТЕПЕРЬ ОНА ЗАПУСКАЕТСЯ.
 *
 * Дефект Ф11 книги «Витрина и машинное отделение». Сравнение наших платежей
 * с тем, что о них знает банк, написано давно, разобрано на чистые функции и
 * покрыто тестами — и не вызывалось ниоткуда: ни расписания, ни команды в
 * package.json, ни шага в выкладке. Единственным способом было открыть
 * терминал и набрать руками.
 *
 * ПОЧЕМУ ЭТО НЕ БЫЛО ПРОСТО ЗАБЫТО. В шапке scripts/reconcile-tinkoff.ts
 * записано осознанное решение: «не подключаем к автоматическому крону —
 * расхождение здесь это P0, который должен увидеть человек, а не то, что
 * тихо само себя чинит». Решение верное, и оно здесь сохранено целиком:
 *
 * · сверка НИЧЕГО не исправляет — ни одной строки Payment она не трогает;
 * · при расхождении она докладывает человеку и умолкает до следующего дня.
 *
 * То есть автоматизирована только та часть, которая и должна быть
 * автоматической: САМ ФАКТ, ЧТО СВЕРКУ СЕГОДНЯ СДЕЛАЛИ. Без неё продукт
 * узнавал о застрявших платежах от людей: в сентябре так нашлись шесть
 * платежей из девяти, где банк деньги взял, а до нас сообщение не дошло.
 *
 * ПОЧЕМУ ОКНО ВЫБОРКИ СЧИТАЕТСЯ ЗДЕСЬ ЗАНОВО. В скрипте оно было пустым:
 * `from` и `to` — один и тот же момент времени, и условие `createdAt >= from
 * AND <= to` попадало ровно в одну миллисекунду. То есть даже запущенная
 * руками сверка сравнивала выписку банка с пустым списком наших платежей и
 * всегда докладывала «у банка есть, у нас нет» про всё подряд. Здесь день
 * берётся целиком.
 */

/** Московские сутки: банк отдаёт выписку по датам, а его даты — московские. */
const MSK_OFFSET_HOURS = 3;

export function moscowDayWindow(day: Date): { from: Date; to: Date; label: string } {
    const shifted = new Date(day.getTime() + MSK_OFFSET_HOURS * 60 * 60 * 1000);
    const label = shifted.toISOString().slice(0, 10);
    const from = new Date(`${label}T00:00:00.000+03:00`);
    const to = new Date(`${label}T23:59:59.999+03:00`);
    return { from, to, label };
}

/**
 * Текст доклада — или null, если докладывать не о чем.
 *
 * Чистая функция: она и решает, считается ли день сошедшимся. «Сошёлся» —
 * это ни одного расхождения ни в одну сторону, а не «расхождений мало».
 */
export function reconciliationReport(
    terminal: string,
    label: string,
    result: ReconciliationResult,
): string | null {
    const problems =
        result.missingInStatement.length + result.missingInDb.length + result.amountMismatches.length;
    if (problems === 0) return null;

    const lines = [`Сверка с банком за ${label} (${terminal}): расхождений — ${problems}.`, ''];

    if (result.missingInStatement.length) {
        lines.push(`У нас оплачено, в выписке нет — ${result.missingInStatement.length}:`);
        for (const payment of result.missingInStatement.slice(0, 10)) {
            lines.push(`· заказ ${payment.orderId}, ${payment.amount / 100} ₽`);
        }
        lines.push('');
    }
    if (result.missingInDb.length) {
        lines.push(`Банк принял, у нас не отмечено — ${result.missingInDb.length}:`);
        for (const op of result.missingInDb.slice(0, 10)) {
            lines.push(`· платёж ${op.paymentId}${op.orderId ? `, заказ ${op.orderId}` : ''}, ${op.amount / 100} ₽`);
        }
        lines.push('');
    }
    if (result.amountMismatches.length) {
        lines.push(`Суммы разошлись — ${result.amountMismatches.length}:`);
        for (const item of result.amountMismatches.slice(0, 10)) {
            lines.push(`· заказ ${item.payment.orderId}: у нас ${item.payment.amount / 100} ₽, у банка ${item.operation.amount / 100} ₽`);
        }
        lines.push('');
    }

    lines.push('Сверка ничего не исправляет: решение за человеком.');
    return lines.join('\n');
}

type Reporter = (text: string) => Promise<void>;

/**
 * Куда уходит доклад. По умолчанию — в тот же операторский чат, куда
 * приходят заказы, и общим путём отправки (прокси, таймаут), а не своим
 * запросом. Не настроен чат — остаётся запись в журнале: молчать о
 * расхождении нельзя, но и падать из-за ненастроенного чата незачем.
 */
async function defaultReporter(text: string): Promise<void> {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
        console.warn('[reconcile] расхождение найдено, TELEGRAM_CHAT_ID не задан — доклад только в журнале');
        console.warn(text);
        return;
    }
    const { sendTelegramMessage } = await import('@/lib/telegram');
    const sent = await sendTelegramMessage(chatId, text);
    if (!sent) console.warn('[reconcile] доклад не ушёл в операторский чат; текст остался в журнале:\n' + text);
}

export async function runDailyPaymentReconciliation(
    now: Date = new Date(),
    reporter: Reporter = defaultReporter,
): Promise<{ checked: number; reported: number; skipped: string[] }> {
    // Вчерашний день: сегодняшний ещё не кончился, и сравнивать его с
    // выпиской бессмысленно — часть платежей просто ещё не случилась.
    const { from, to, label } = moscowDayWindow(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    const skipped: string[] = [];
    if (isDemoTerminal()) {
        // На демонстрационном терминале сверять нечего: боевых платежей на
        // нём не бывает, а доклад «у банка ничего нет» был бы ложной тревогой.
        skipped.push('demo');
        return { checked: 0, reported: 0, skipped };
    }

    const payments: KnownPayment[] = await db.payment.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { orderId: true, tinkoffPaymentId: true, amount: true, status: true },
    });

    let checked = 0;
    let reported = 0;
    for (const terminal of paymentTerminals()) {
        try {
            const operations = await fetchStatement({
                terminalKey: terminal.terminalKey,
                password: terminal.password,
                from,
                to,
            });
            const result = reconcilePayments(payments, operations);
            checked += 1;
            const text = reconciliationReport(terminal.terminal, label, result);
            if (text) {
                reported += 1;
                await reporter(text);
            } else {
                console.log(`[reconcile] ${label} (${terminal.terminal}): сошлось, совпало ${result.matched}`);
            }
        } catch (error) {
            // Отказ банка — это не расхождение. Человека будить незачем, но
            // и делать вид, что сверка прошла, нельзя: терминал попадает в
            // список пропущенных, и следующий запуск попробует снова.
            skipped.push(terminal.terminal);
            console.error(`[reconcile] ${label} (${terminal.terminal}): выписка не получена —`, error);
        }
    }

    return { checked, reported, skipped };
}
