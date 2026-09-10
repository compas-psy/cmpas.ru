// База сама отказывает второй учётной записи, различающейся только регистром.
//
// Сравнение уже нечувствительно к регистру (tests/auth-email-case.test.ts), и
// через код второго пользователя не завести. Но код — не последняя линия:
// импорт, правка руками в psql, будущий путь регистрации, о котором сегодня
// никто не думает, кладут строки мимо этого сравнения.
//
// Отсюда функциональный уникальный индекс по lower(email). Проверяется он
// здесь, а не через Prisma: функциональный индекс в схеме Prisma не
// выражается и живёт только в миграции — то есть его легко снести, не заметив.
// Тест читает файл миграции и падает, если он исчез или изменил смысл.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const MIGRATION = path.join(
    process.cwd(),
    'prisma/migrations/20260910120000_user_email_lower_unique/migration.sql',
);

describe('уникальность почты без учёта регистра держится базой', () => {
    it('миграция на месте', () => {
        expect(existsSync(MIGRATION)).toBe(true);
    });

    it('индекс уникальный, функциональный и по нужной таблице', () => {
        const sql = readFileSync(MIGRATION, 'utf8');
        const statement = sql.split('\n').filter(l => !l.trim().startsWith('--')).join(' ');

        expect(statement).toMatch(/CREATE\s+UNIQUE\s+INDEX/i);
        expect(statement).toMatch(/"User"/);
        expect(statement).toMatch(/lower\(\s*email\s*\)/i);
    });

    it('повторная выкладка не роняет прогон', () => {
        // Миграции у нас накатываются на живую базу, и на уже применённой
        // миграции CREATE INDEX без IF NOT EXISTS отказал бы. Это не
        // перестраховка: тот же приём стоит во всех наших добавляющих
        // миграциях.
        expect(readFileSync(MIGRATION, 'utf8')).toMatch(/IF NOT EXISTS/i);
    });

    it('схема Prisma говорит, что этот индекс существует и его нельзя сносить', () => {
        // Единственная защита от `prisma migrate dev`, который предложил бы
        // удалить неизвестный ему индекс: человек должен прочитать про него
        // там, где смотрит на поле.
        const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
        expect(schema).toContain('20260910120000_user_email_lower_unique');
    });
});
