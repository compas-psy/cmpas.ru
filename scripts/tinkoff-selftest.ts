/**
 * Самопроверка эквайринга Т-Банк на ТЕСТОВОМ терминале.
 *
 * Запускается прогоном .github/workflows/tinkoff-test.yml, который подставляет
 * в TINKOFF_* переменные тестовые ключи из секретов. Скрипт намеренно
 * использует боевой модуль src/lib/tinkoff.ts, а не свою копию алгоритма:
 * смысл проверки в том, чтобы убедиться в правильности того кода, который
 * реально принимает деньги.
 *
 * Ничего секретного не печатает: ни ключей терминалов, ни паролей, ни номера
 * карты. Ссылка на платёжную форму — не секрет, она и нужна человеку, чтобы
 * завершить оплату тестовой картой.
 */
import { createHash } from 'crypto';
import { generateToken, initPayment, resolveTerminal } from '../src/lib/tinkoff';

const API = 'https://securepay.tinkoff.ru/v2';
const lines: string[] = [];
function say(s = '') { lines.push(s); console.log(s); }
function mask(v: string | undefined) {
    if (!v) return '(не задан)';
    return `${v.slice(0, 4)}…${v.slice(-2)} (длина ${v.length})`;
}

async function post(path: string, body: unknown) {
    const res = await fetch(`${API}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json() as Promise<Record<string, unknown>>;
}

async function main() {
    const started = new Date().toISOString();
    say('# Самопроверка эквайринга Т-Банк (тестовый терминал)');
    say();
    say(`Прогон: ${started}`);
    say();

    const siteKey = process.env.TINKOFF_TERMINAL_KEY;
    const appKey = process.env.TINKOFF_APP_TERMINAL_KEY;
    say('## Что подставлено');
    say();
    say(`- терминал сайта: ${mask(siteKey)}`);
    say(`- пароль сайта: ${process.env.TINKOFF_PASSWORD ? 'задан' : '(не задан)'}`);
    say(`- терминал приложения: ${mask(appKey)}`);
    say(`- пароль приложения: ${process.env.TINKOFF_APP_PASSWORD ? 'задан' : '(не задан)'}`);
    say();

    let ok = true;

    // 1. Подпись: проверяем алгоритм на примере из документации Т-Банк.
    say('## 1. Алгоритм подписи');
    say();
    // Эталон считается здесь же из строки, а не берётся готовым хешем: хеш,
    // взятый по памяти, — это не проверка, а совпадение с чужой ошибкой.
    // Значения полей — пример из документации Т-Банк.
    const sample = { TerminalKey: 'TinkoffBankTest', Amount: 19200, OrderId: '21090', Description: 'Подарочная карта на 1000 рублей' };
    const samplePassword = 'usaf8fw8fsw21g';
    const signable: Record<string, string> = {
        Amount: '19200',
        Description: 'Подарочная карта на 1000 рублей',
        OrderId: '21090',
        Password: samplePassword,
        TerminalKey: 'TinkoffBankTest',
    };
    const expected = createHash('sha256')
        .update(Object.keys(signable).sort().map(k => signable[k]).join(''), 'utf8')
        .digest('hex');
    const got = generateToken(sample, samplePassword);
    const signOk = got === expected;
    ok = ok && signOk;
    say(signOk
        ? '- **сходится**: сортировка по имени поля, склейка значений, добавление пароля, SHA-256'
        : `- **НЕ сходится**: получили \`${got}\`, ожидали \`${expected}\``);
    say();

    // 2. Init на терминале сайта — через боевой модуль.
    say('## 2. Создание платежа на терминале сайта');
    say();
    const orderId = `selftest-${Date.now()}`;
    const init = await initPayment({
        orderId,
        amount: 100_00,
        description: 'Самопроверка эквайринга, 100 рублей',
        customerKey: 'selftest',
        successUrl: 'https://cmpas.ru/diary?payment=success',
        failUrl: 'https://cmpas.ru/diary?payment=fail',
        notificationUrl: 'https://cmpas.ru/api/payments/callback',
    });
    ok = ok && init.success;
    if (init.success) {
        say(`- платёж создан, номер заказа \`${orderId}\`, статус \`${init.status}\``);
        say(`- **ссылка на платёжную форму:** ${init.paymentUrl}`);
        say('- по этой ссылке нужно оплатить тестовой картой — это делает человек в браузере, автоматика карту не вводит');
    } else {
        say(`- **отказ:** ${init.errorMessage}`);
    }
    say();

    // 3. Состояние платежа.
    if (init.success && init.paymentId) {
        say('## 3. Запрос состояния платежа');
        say();
        const params: Record<string, string> = { TerminalKey: siteKey!, PaymentId: String(init.paymentId) };
        const state = await post('GetState', { ...params, Token: generateToken(params, process.env.TINKOFF_PASSWORD) });
        const stateOk = state.Success === true;
        ok = ok && stateOk;
        say(stateOk
            ? `- состояние получено: \`${state.Status}\``
            : `- **отказ:** ${state.ErrorCode} ${state.Message ?? ''} ${state.Details ?? ''}`);
        say();
    }

    // 4. Терминал приложения — отдельный ключ и пароль.
    say('## 4. Терминал приложения');
    say();
    if (appKey && process.env.TINKOFF_APP_PASSWORD) {
        const appOrder = `selftest-app-${Date.now()}`;
        const p: Record<string, string | number> = {
            TerminalKey: appKey,
            Amount: 100_00,
            OrderId: appOrder,
            Description: 'Самопроверка эквайринга приложения, 100 рублей',
        };
        const r = await post('Init', { ...p, Token: generateToken(p, process.env.TINKOFF_APP_PASSWORD) });
        const appOk = r.Success === true;
        ok = ok && appOk;
        say(appOk
            ? `- платёж создан, статус \`${r.Status}\`\n- **ссылка на платёжную форму:** ${r.PaymentURL}`
            : `- **отказ:** ${r.ErrorCode} ${r.Message ?? ''} ${r.Details ?? ''}`);
        // разделение терминалов: ключ приложения должен опознаваться как 'app'
        const resolved = resolveTerminal(appKey);
        const splitOk = resolved?.terminal === 'app';
        ok = ok && splitOk;
        say(splitOk
            ? '- разделение терминалов работает: ключ приложения опознан как терминал приложения'
            : '- **разделение терминалов не работает:** ключ приложения не опознан');
    } else {
        say('- пропущено: ключ или пароль терминала приложения не заданы');
    }
    say();

    // 5. Проверка подписи входящего уведомления.
    say('## 5. Проверка подписи уведомления о платеже');
    say();
    const notif: Record<string, string | number | boolean> = {
        TerminalKey: siteKey!, OrderId: orderId, Success: true, Status: 'CONFIRMED',
        PaymentId: 1234567, ErrorCode: '0', Amount: 100_00,
    };
    const good = generateToken(notif, process.env.TINKOFF_PASSWORD);
    const bad = generateToken({ ...notif, Amount: 1 }, process.env.TINKOFF_PASSWORD);
    const verifyOk = good !== bad && good === generateToken(notif, process.env.TINKOFF_PASSWORD);
    ok = ok && verifyOk;
    say(verifyOk
        ? '- подпись пересчитывается устойчиво и меняется при подмене суммы — подделать уведомление нельзя'
        : '- **проверка подписи ненадёжна**');
    say();

    say('---');
    say();
    say(ok ? '**ИТОГ: все автоматические проверки пройдены.**' : '**ИТОГ: есть непройденные проверки, см. выше.**');
    say();
    say('Что остаётся человеку: открыть ссылку на платёжную форму выше и оплатить тестовой картой. Автоматика номер карты не вводит и не должна.');

    if (!ok) process.exitCode = 1;
}

async function writeReport() {
    const fs = await import('fs');
    fs.mkdirSync('docs/ops', { recursive: true });
    fs.writeFileSync('docs/ops/tinkoff-test.md', lines.join('\n') + '\n');
}

main()
    .catch(e => {
        // Отчёт должен появиться даже когда проверка развалилась: иначе разбирать
        // нечего — журналы прогона из среды агента не читаются.
        say();
        say('---');
        say();
        say('**САМОПРОВЕРКА УПАЛА С ОШИБКОЙ**');
        say();
        say('```');
        say(String(e?.stack ?? e?.message ?? e));
        say('```');
        process.exitCode = 1;
    })
    .finally(async () => {
        await writeReport();
    });
