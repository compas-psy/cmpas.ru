// «МОИ СЕССИИ» В БОТЕ ГОВОРИЛИ ЧЕЛОВЕКУ НЕПРАВДУ.
//
// Оба бота отбирали клиенту только подтверждённые встречи. Человек
// записывался, через минуту спрашивал бота про свои записи — и слышал «у вас
// нет предстоящих записей», хотя сообщение об этой самой записи прислал ему
// тот же бот минутой раньше: только что созданная встреча ждёт подтверждения.
//
// Вторым дефектом кнопка «Перенести» в этом списке вела на страницу НОВОЙ
// записи — подбор времени с нуля, при том что собственная встреча человека
// оставалась на месте. Этот дефект был найден и закрыт в напоминаниях и в
// сообщении о записи (session-action-links.ts — один источник трёх адресов),
// но в командах бота адрес собирался по месту и остался старым.
//
// Тест смотрит на исходный текст: воспроизводить диалог с двумя разными
// мессенджерами дороже, чем стеречь само правило.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
/**
 * Только код, без комментариев: объяснение дефекта в комментарии обязано
 * называть его своими словами, иначе оно ничего не объясняет. Проверяем то,
 * что уходит человеку, а не то, что написано рядом для нас.
 */
function code(path: string): string {
    return readFileSync(join(root, path), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
}

const telegram = code('src/lib/telegram-bot.ts');
const max = code('src/lib/max-bot.ts');

/** Отбор встреч КЛИЕНТА — по clientId. Отбор встреч специалиста тут ни при чём. */
function clientSessionQueries(source: string): string[] {
    return source
        .split('\n')
        .filter((line) => line.includes('clientId: client.id') || line.includes('clientId: client.id,'));
}

describe('список записей клиента в боте', () => {
    it('Telegram показывает и ожидающие подтверждения встречи', () => {
        const lines = clientSessionQueries(telegram);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(line).not.toContain("status: 'confirmed'");
    });

    it('MAX показывает и ожидающие подтверждения встречи', () => {
        const lines = clientSessionQueries(max);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) expect(line).not.toContain("status: 'confirmed'");
    });

    it('оба бота берут три действия из общего источника, а не собирают адрес по месту', () => {
        expect(telegram).toContain("from '@/lib/practice/session-action-links'");
        expect(max).toContain("from '@/lib/practice/session-action-links'");
        expect(telegram).toContain('sessionActionButtons(');
        expect(max).toContain('sessionActionButtons(');
    });

    it('«Перенести» больше не открывает подбор времени с нуля', () => {
        expect(telegram).not.toContain("text: 'Перенести', web_app");
    });

    it('бот здоровается от имени ПРАКТИКИ, а не продукта, которого нет', () => {
        expect(telegram).not.toContain('Compas.ru');
    });

    it('клиенту не предлагают открыть кабинет специалиста', () => {
        // В ветках для клиента (справка и заглушка MAX) не должно быть кнопки
        // в /diary: войти туда клиенту нечем.
        expect(max).not.toContain("'Доступные команды:\\n\\n/sessions — ваши ближайшие записи\\n/help — эта справка\\n/connect");
        expect(max.match(/Открыть ПРАКТИКУ/g) ?? []).toHaveLength(0);
    });
});

/**
 * ТА ЖЕ ПРАВКА — В ВЕТКЕ СПЕЦИАЛИСТА.
 *
 * Дефект П2 книги 3. Фильтр «только подтверждённые» убрали у клиента в обоих
 * ботах и оставили у специалиста в обоих же. У него это тяжелее: у клиента
 * одна встреча, у специалиста день. Клиенты жмут «Подтверждаю» далеко не
 * всегда, и человек с пятью приёмами сегодня слышал, что сессий у него нет.
 */
describe('список встреч специалиста в боте', () => {
    /**
     * Запросы ВСТРЕЧ специалиста.
     *
     * Не «строки с psychologistId»: он же стоит в разборе пересланного
     * контакта, который к списку встреч отношения не имеет. Берём кусок
     * после каждого diarySession.findMany — там и фильтр, и предел.
     */
    const psySessionQueries = (source: string): string[] => {
        const blocks: string[] = [];
        const needle = 'db.diarySession.findMany';
        let at = source.indexOf(needle);
        while (at !== -1) {
            const block = source.slice(at, at + 400);
            if (block.includes('psychologistId: psy.id')) blocks.push(block);
            at = source.indexOf(needle, at + 1);
        }
        return blocks;
    };

    it.each([['Telegram', telegram], ['MAX', max]])(
        '%s показывает специалисту и ожидающие подтверждения встречи',
        (_name, source) => {
            const blocks = psySessionQueries(source);
            expect(blocks.length).toBeGreaterThan(0);
            for (const block of blocks) expect(block).not.toContain("status: 'confirmed',");
        },
    );

    it('оба бота берут число встреч и заголовок из общего источника', () => {
        // Именно так разошлась предыдущая правка: в одном боте сделали, в
        // другом забыли. Число, которое негде забыть, разойтись не может.
        for (const source of [telegram, max]) {
            expect(source).toContain("from '@/lib/messaging/bot-session-list'");
            expect(source).toContain('SESSIONS_IN_BOT');
            expect(source).toContain('sessionsHeading(');
        }
    });

    it('ни один бот не держит своё число ВСТРЕЧ', () => {
        // Смотрим на запросы встреч, а не на весь файл: в подсказке Telegram
        // есть свой take: 5 для свободных окон расписания, и он тут ни при чём.
        for (const source of [telegram, max]) {
            const blocks = psySessionQueries(source);
            expect(blocks.length).toBeGreaterThan(0);
            for (const block of blocks) {
                expect(block).not.toMatch(/take:\s*5\b/);
                expect(block).toContain('SESSIONS_IN_BOT');
            }
        }
    });

    it('состояние встречи названо словом, а не молчанием', () => {
        for (const source of [telegram, max]) {
            expect(source).toContain('Ждёт подтверждения');
        }
    });

    it('пустой список больше не говорит «подтверждённых»', () => {
        // Прежний текст «нет предстоящих подтверждённых сессий» был формально
        // верен и practически бесполезен: человек читал его как «встреч нет».
        for (const source of [telegram, max]) {
            expect(source).not.toContain('предстоящих подтвержденных');
            expect(source).toContain('нет предстоящих встреч');
        }
    });
});

describe('заголовок списка честен насчёт обрезки', () => {
    it('показано меньше пяти — значит показано всё', async () => {
        const { sessionsHeading, SESSIONS_IN_BOT } = await import('@/lib/messaging/bot-session-list');
        expect(SESSIONS_IN_BOT).toBe(5);
        expect(sessionsHeading(3)).toBe('Ваши ближайшие встречи:');
    });

    it('показано пять — значит могут быть и другие, и об этом сказано', async () => {
        const { sessionsHeading } = await import('@/lib/messaging/bot-session-list');
        expect(sessionsHeading(5)).toContain('остальные в кабинете');
    });
});
