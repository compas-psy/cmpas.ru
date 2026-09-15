import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * РАЗБОР, КОТОРЫЙ НЕ ЧИТАЕТСЯ, — НЕ РАЗБОР.
 *
 * 15.09.2026 учредитель открыл присланные книги и увидел вместо кириллицы
 * кракозябры. Файлы на диске были в UTF-8 — врал не текст, а его отсутствие:
 * ни `<!doctype>`, ни `<meta charset>` в них не было вовсе, и браузер,
 * открывая ЛОКАЛЬНЫЙ файл, кодировку угадывал. На сервере её сообщает
 * заголовок ответа, поэтому в вебе всё выглядело правильно, — а документ
 * этого рода читают именно с диска, переслав.
 *
 * Пять документов уехали человеку нечитаемыми, и заметил это он, а не мы.
 * Поэтому проверка смотрит на каталог целиком: следующая книга получит её
 * автоматически, а не по памяти автора.
 */

const DIR = join(__dirname, '..', 'docs', 'cjm');

const files = readdirSync(DIR).filter(f => f.endsWith('.html'));

describe('разборы CJM открываются с диска и читаются', () => {
    it('в каталоге вообще есть документы', () => {
        // Иначе проверка ниже прошла бы на пустом списке и молчала бы всегда.
        expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)('%s объявляет кодировку', (name) => {
        const head = readFileSync(join(DIR, name), 'utf-8').slice(0, 1024);
        // Именно в первом килобайте: дальше браузер объявление уже не ищет.
        expect(head).toMatch(/<meta\s+charset="utf-8">/i);
    });

    it.each(files)('%s объявляет тип документа и язык', (name) => {
        const head = readFileSync(join(DIR, name), 'utf-8').slice(0, 1024);
        expect(head).toMatch(/^<!doctype html>/i);
        expect(head).toMatch(/<html lang="ru">/i);
    });

    it.each(files)('%s помещается в телефон', (name) => {
        // Книги читают и с телефона; без этой строки страница открывается
        // в масштабе рабочего стола и текст приходится разводить пальцами.
        const head = readFileSync(join(DIR, name), 'utf-8').slice(0, 1024);
        expect(head).toMatch(/<meta\s+name="viewport"/i);
    });

    it.each(files)('%s и правда лежит в UTF-8, а не только обещает', (name) => {
        const raw = readFileSync(join(DIR, name));
        // Строгий разбор: битый байт в UTF-8 бросает, а не подставляет «?».
        expect(() => new TextDecoder('utf-8', { fatal: true }).decode(raw)).not.toThrow();
        // И кириллица в нём есть — иначе проверка выше ничего не стоит.
        expect(raw.toString('utf-8')).toMatch(/[а-яё]/i);
    });
});
