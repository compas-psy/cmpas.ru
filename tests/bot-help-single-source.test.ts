import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { botHelpText } from '@/lib/messaging/bot-help';
import { HELP_TOPICS } from '@/app/diary/help/content';

/**
 * СПРАВКА СУЩЕСТВОВАЛА В ТРЁХ ВИДАХ, И В ДВУХ ИЗ НИХ ЕЁ НЕ БЫЛО.
 *
 * Дефект П10 книги 3. В вебе — восемь тем, написанных живым языком. В MAX —
 * команда /help с двумя кнопками и своим списком команд. В Telegram — ни
 * команды, ни кнопки: человек узнавал о возможностях бота, только если
 * угадает слово в меню. В приложении — лист с версией и отпечатком подписи
 * и фразой «Опишите вопрос в поддержке» без единой двери наружу.
 *
 * Правка не пишет справку заново — текст уже есть. Она его открывает.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Только код: объяснение дефекта рядом не должно подтверждать само себя. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('справка в боте — один текст на два мессенджера', () => {
    it('оба бота зовут общий модуль', () => {
        for (const file of ['src/lib/telegram-bot.ts', 'src/lib/max-bot.ts']) {
            expect(code(read(file)), `${file} пишет справку по месту`)
                .toContain("from '@/lib/messaging/bot-help'");
        }
    });

    it('в Telegram появилась и команда, и кнопка', () => {
        const telegram = code(read('src/lib/telegram-bot.ts'));
        expect(telegram).toContain("bot.command('help'");
        expect(telegram).toContain("bot.hears(['Справка']");
        // И кнопка в меню: команду ещё надо знать, кнопку человек видит.
        expect(telegram).toContain("'Справка'");
    });

    it('ни один бот не держит свой список команд', () => {
        for (const file of ['src/lib/telegram-bot.ts', 'src/lib/max-bot.ts']) {
            expect(code(read(file)), `${file} перечисляет команды сам`)
                .not.toContain('/sessions — ');
        }
    });
});

describe('что бот говорит специалисту', () => {
    const help = botHelpText(true);

    it('называет все восемь разделов справки', () => {
        expect(HELP_TOPICS).toHaveLength(8);
        for (const topic of HELP_TOPICS) {
            expect(help.text, `раздел «${topic.title}» не назван`).toContain(topic.title);
        }
    });

    it('разделы берутся из самой справки, а не переписаны', () => {
        // Перепиши их здесь — и однажды в кабинете появится девятый, о
        // котором бот не скажет.
        const content = code(read('src/lib/messaging/bot-help.ts'));
        expect(content).toContain("from '@/app/diary/help/content'");
        expect(content).toContain('HELP_TOPICS');
    });

    it('ведёт в готовый текст, а не пересказывает его', () => {
        expect(help.links.map((l) => l.path)).toContain('/diary/help');
    });
});

describe('что бот говорит клиенту', () => {
    const help = botHelpText(false);

    it('не предлагает кабинет — войти туда клиенту нечем', () => {
        expect(help.links).toHaveLength(0);
        expect(help.text).not.toContain('/diary');
        expect(help.text).not.toContain('кабинет');
    });

    it('говорит то, что клиенту правда нужно: запись идёт по ссылке специалиста', () => {
        expect(help.text).toContain('ссылке');
        expect(help.text).toContain('специалист');
    });

    it('не обещает команд, которых у клиента нет', () => {
        expect(help.text).not.toContain('/link');
        expect(help.text).not.toContain('/connect');
    });
});

describe('справка в приложении перестала быть тупиком', () => {
    const settings = read('android/app/src/main/java/ru/cmpas/app/presentation/settings/SettingsScreen.kt');
    const settingsCode = code(settings);

    it('из шторки помощи есть дверь в саму справку', () => {
        expect(settings).toContain('Открыть справку');
        expect(settings).toContain('/diary/help');
    });

    it('исчезла фраза, отправлявшая человека в никуда', () => {
        // «Опишите вопрос в поддержке» — где поддержка, сказано не было.
        expect(settingsCode).not.toContain('Опишите вопрос в поддержке');
    });

    it('отпечаток подписи остался: он нужен именно при обращении', () => {
        expect(settings).toContain('SHA-256');
    });
});
