/**
 * Как выглядят автоматические сообщения.
 *
 * Решение учредителя: «Эмодзи не авторские, а стандартные, поэтому выглядят
 * некрасиво. Кроме того, следи, чтобы сообщение выглядело всегда аккуратно и
 * прячь ссылки за слово, а не выдавай всю огромную ссылку».
 *
 * Это правило про КАЖДОЕ сообщение, а не про те полтора десятка, что были
 * вычищены руками: следующее уведомление напишут через неделю, и без сторожа
 * «📅» вернётся туда сам собой. Поэтому список файлов, которые сочиняют
 * текст для человека, перечислен явно, и он проверяется целиком.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { htmlToPlain } from '@/lib/messaging/format';
import path from 'path';

/** Файлы, которые сочиняют текст, уходящий человеку. */
const MESSAGE_FILES = [
    'src/lib/cron/reminder-text.ts',
    'src/lib/cron/reminders.ts',
    'src/lib/cron/digest.ts',
    'src/lib/cron/post-session.ts',
    'src/lib/cron/post-session-cascade.ts',
    'src/lib/cron/scheduled-messages.ts',
    'src/lib/client-workflow.ts',
    'src/lib/telegram-bot.ts',
    'src/lib/max-bot.ts',
    'src/lib/waitlist-notify.ts',
    'src/lib/email-template.ts',
    'src/lib/clients/contact-intake-messages.ts',
    'src/app/bot/actions.ts',
    'src/app/diary/actions/availability.ts',
    'src/app/diary/actions/notifications.ts',
    'src/app/api/user/diary/bot/client/cancel/route.ts',
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

/**
 * Комментарий — не сообщение.
 *
 * В комментарии рядом с правкой уместно назвать эмодзи, который убрали: это
 * и есть объяснение. Сторож, читающий комментарии, требовал бы вычищать
 * ровно те примеры, ради которых они написаны.
 */
function codeLines(source: string): Array<{ n: number; text: string }> {
    const lines: Array<{ n: number; text: string }> = [];
    let inBlock = false;
    source.split('\n').forEach((raw, index) => {
        const text = raw.trim();
        if (inBlock) {
            if (text.includes('*/')) inBlock = false;
            return;
        }
        if (text.startsWith('/*')) {
            if (!text.includes('*/')) inBlock = true;
            return;
        }
        if (text.startsWith('//') || text.startsWith('*') || text.startsWith('<!--')) return;
        lines.push({ n: index + 1, text });
    });
    return lines;
}

/**
 * Старые надписи кнопок продолжают приниматься на входе.
 *
 * Клавиатура Telegram живёт в клиенте, пока бот не пришлёт новую: человек,
 * нажавший кнопку «💼 Мой кабинет» со старой клавиатуры, должен получить
 * ответ, а не молчание. Такие строки — приём, а не отправка.
 */
const ACCEPTS_OLD_BUTTON = /bot\.hears|text ===/;

/**
 * Письмо простым текстом — единственный канал вообще без разметки.
 *
 * У почтового клиента нет ни кнопок, ни якорей в plain-text части: спрятать
 * там адрес некуда, и убрать его значит оставить человека без входа. Это
 * исключение названо, а не спрятано.
 */
const PLAIN_TEXT_EMAIL = 'src/lib/email-template.ts';

describe('автоматические сообщения', () => {
    it('все перечисленные файлы существуют', () => {
        // Файл переименовали или удалили — сторож обязан упасть, а не тихо
        // перестать проверять то, что ему поручено.
        const missing = MESSAGE_FILES.filter(f => !existsSync(path.join(process.cwd(), f)));
        expect(missing).toEqual([]);
    });

    it('в них нет эмодзи', () => {
        const found: string[] = [];
        for (const file of MESSAGE_FILES) {
            const source = readFileSync(path.join(process.cwd(), file), 'utf8');
            for (const { n, text } of codeLines(source)) {
                if (ACCEPTS_OLD_BUTTON.test(text)) continue;
                if (EMOJI.test(text)) found.push(`${file}:${n} — ${text.slice(0, 80)}`);
            }
        }
        expect(found).toEqual([]);
    });

    it('ссылка не вклеивается голым адресом в середину строки', () => {
        // «${bookUrl}» внутри текста сообщения — это адрес на полторы строки
        // в теле письма. Место ссылки — кнопка или подпись через messageLink.
        //
        // Отличить сообщение от построения адреса можно по словам: в тексте,
        // который читает человек, они есть, а в `${publicBaseUrl()}/bot/book/…`
        // их нет. Это надёжнее списка known-хороших имён переменных, который
        // пришлось бы дополнять при каждом новом строителе ссылок.
        const found: string[] = [];
        const template = /`[^`]*`/g;
        // Имя, оканчивающееся на Text/Line/Label, — это уже собранный текст
        // («linkText» приходит из onlineLinkLine), а не голый адрес.
        const interpolatedUrl = /\$\{[^}]*(?:[Uu]rl|[Ll]ink)(?![^}]*(?:Text|Line|Label))[^}]*\}/;
        const hasWords = /[а-яё]{3}/i;
        const alreadyHidden = /(?:messageLink|onlineLinkLine|\blink)\(/;

        for (const file of MESSAGE_FILES) {
            if (file === PLAIN_TEXT_EMAIL) continue;
            const source = readFileSync(path.join(process.cwd(), file), 'utf8');
            for (const { n, text } of codeLines(source)) {
                // Адрес на месте кнопки или в якоре — там ему и место.
                if (/\burl:\s/.test(text) || /href=/.test(text)) continue;
                if (alreadyHidden.test(text)) continue;

                for (const literal of text.match(template) ?? []) {
                    if (!interpolatedUrl.test(literal)) continue;
                    // Нет слов — это сам адрес, а не сообщение.
                    if (!hasWords.test(literal)) continue;
                    found.push(`${file}:${n} — ${text.slice(0, 90)}`);
                    break;
                }
            }
        }

        expect(found).toEqual([]);
    });
});
/**
 * MAX не понимает разметку Telegram.
 *
 * Сообщения у нас общие: одно и то же напоминание уходит в оба мессенджера.
 * Если бы якорь `<a href>` доехал до MAX как есть, клиент увидел бы теги —
 * и это было бы хуже голой ссылки, которую мы и убирали.
 */
describe('перевод разметки для MAX', () => {
    it('ссылка становится «подпись: адрес», а не тегами', () => {
        expect(htmlToPlain('Записаться можно <a href="https://cmpas.ru/u/anna">здесь</a>.'))
            .toBe('Записаться можно здесь: https://cmpas.ru/u/anna.');
    });

    it('жирный просто снимается', () => {
        expect(htmlToPlain('<b>Итоги недели</b>')).toBe('Итоги недели');
    });

    it('адрес не задваивается, если подпись и есть адрес', () => {
        expect(htmlToPlain('<a href="https://cmpas.ru">https://cmpas.ru</a>')).toBe('https://cmpas.ru');
    });

    it('экранированные символы возвращаются на место', () => {
        // Иначе клиент прочитал бы «Иванов &amp; Петров».
        expect(htmlToPlain('Иванов &amp; Петров')).toBe('Иванов & Петров');
    });

    it('обычный текст не портится', () => {
        expect(htmlToPlain('Сессия начнётся через 1 час, в 18:00.')).toBe('Сессия начнётся через 1 час, в 18:00.');
    });
});
