// Разбор vCard нужен ровно из-за MAX: он присылает контакт не полями, а
// строкой vcf_info (см. официальный SDK @maxhub/max-bot-api,
// ContactAttachment). Telegram отдаёт phone_number и first_name готовыми,
// разбирать там нечего.
//
// Нам нужны два поля — имя и телефон. Но взять их регуляркой по всему
// тексту нельзя: телефон встречается и в чужих строках, а имя бывает
// закодировано. Поэтому тут проверяются ровно те случаи, на которых
// наивный разбор ломается, — и все они настоящие, не выдуманные.

import { describe, it, expect } from 'vitest';
import { parseVCard } from '@/lib/clients/vcard';

describe('parseVCard — имя и телефон из настоящих карточек', () => {
    it('простая карточка: FN и TEL', () => {
        const vcf = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'FN:Анна Волкова',
            'TEL:+79161234567',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf)).toEqual({ fullName: 'Анна Волкова', phone: '+79161234567' });
    });

    it('TEL с параметрами — их отбрасываем, значение берём после двоеточия', () => {
        // Так пишут и iOS, и Android: TEL;TYPE=CELL:, TEL;type=CELL;type=VOICE;type=pref:
        const vcf = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            'FN:Пётр Ильин',
            'TEL;TYPE=CELL;TYPE=VOICE;TYPE=pref:+7 916 765-43-21',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).phone).toBe('+7 916 765-43-21');
    });

    it('первым берётся мобильный, даже если он не первый в карточке', () => {
        // Иначе в карточку клиента попадёт рабочий городской, а написать
        // ему в мессенджер по нему нельзя.
        const vcf = [
            'BEGIN:VCARD',
            'FN:Мария Соколова',
            'TEL;TYPE=WORK:+74951234567',
            'TEL;TYPE=CELL:+79031112233',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).phone).toBe('+79031112233');
    });

    it('нет FN — собираем имя из N в порядке «Фамилия;Имя;Отчество»', () => {
        const vcf = [
            'BEGIN:VCARD',
            'N:Соколова;Мария;Петровна;;',
            'TEL:+79031112233',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).fullName).toBe('Мария Соколова');
    });

    it('сложенная строка склеивается без лишнего пробела', () => {
        // Складывание по RFC 6350: строка длиннее 75 октетов переносится,
        // продолжение начинается с пробела или табуляции, и при развёртке
        // убираются ОБА — перенос и этот пробел. Слово, разорванное
        // переносом, обязано снова стать целым: лишний пробел дал бы
        // «Ковалевская-Ш терн».
        const vcf = [
            'BEGIN:VCARD',
            'FN:Анастасия Ковалевская-Ш',
            ' терн',
            'TEL:+79161234567',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).fullName).toBe('Анастасия Ковалевская-Штерн');
    });

    it('quoted-printable в кириллице раскодируется', () => {
        // Так пишут старые Android-экспорты: vCard 2.1 с CHARSET=UTF-8 и
        // ENCODING=QUOTED-PRINTABLE. Без раскодирования в карточку попадёт
        // «=D0=90=D0=BD=D0=BD=D0=B0» вместо имени.
        const vcf = [
            'BEGIN:VCARD',
            'VERSION:2.1',
            'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D0=90=D0=BD=D0=BD=D0=B0',
            'TEL;CELL:+79161234567',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).fullName).toBe('Анна');
    });

    it('мягкий перенос quoted-printable (= в конце строки) склеивается', () => {
        const vcf = [
            'BEGIN:VCARD',
            'VERSION:2.1',
            'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D0=90=D0=BD=D0=BD=D0=B0=20=',
            '=D0=92=D0=BE=D0=BB=D0=BA=D0=BE=D0=B2=D0=B0',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).fullName).toBe('Анна Волкова');
    });

    it('перевод строки \\n без \\r тоже разбирается', () => {
        const vcf = 'BEGIN:VCARD\nFN:Иван Петров\nTEL:+79001112233\nEND:VCARD';
        expect(parseVCard(vcf)).toEqual({ fullName: 'Иван Петров', phone: '+79001112233' });
    });

    it('экранированные запятая и точка с запятой в FN разэкранируются', () => {
        const vcf = 'BEGIN:VCARD\r\nFN:Волкова\\, Анна\r\nEND:VCARD';
        expect(parseVCard(vcf).fullName).toBe('Волкова, Анна');
    });

    it('свойство с группой (item1.TEL) распознаётся', () => {
        // iOS повсеместно пишет группы: item1.TEL;type=CELL:+7...
        const vcf = [
            'BEGIN:VCARD',
            'item1.TEL;type=CELL;type=VOICE:+79161234567',
            'item1.X-ABLabel:мобильный',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).phone).toBe('+79161234567');
    });

    it('пустая строка, мусор и отсутствие карточки не роняют разбор', () => {
        expect(parseVCard('')).toEqual({});
        expect(parseVCard('это не vCard')).toEqual({});
        expect(parseVCard('BEGIN:VCARD\r\nEND:VCARD')).toEqual({});
    });

    it('TEL без значения не выдаётся за телефон', () => {
        const vcf = 'BEGIN:VCARD\r\nFN:Без телефона\r\nTEL;TYPE=CELL:\r\nEND:VCARD';
        const parsed = parseVCard(vcf);
        expect(parsed.fullName).toBe('Без телефона');
        expect(parsed.phone).toBeUndefined();
    });

    it('строка EMAIL с цифрами не подхватывается как телефон', () => {
        // Проверка против наивного «найти цифры во всём тексте».
        const vcf = [
            'BEGIN:VCARD',
            'FN:Тест',
            'EMAIL:79161234567@example.invalid',
            'END:VCARD',
        ].join('\r\n');
        expect(parseVCard(vcf).phone).toBeUndefined();
    });
});
