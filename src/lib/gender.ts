// Russian name gender detection
// Uses common Russian first names to determine gender with high probability

import { extractFirstName } from '@/lib/person-name';

const maleNames = new Set([
    'александр', 'алексей', 'андрей', 'антон', 'артём', 'артем', 'богдан', 'борис',
    'вадим', 'валентин', 'валерий', 'василий', 'виктор', 'виталий', 'владимир', 'владислав',
    'геннадий', 'георгий', 'глеб', 'григорий', 'даниил', 'данил', 'денис', 'дмитрий',
    'евгений', 'егор', 'иван', 'игорь', 'илья', 'кирилл', 'константин', 'лев',
    'леонид', 'максим', 'марк', 'матвей', 'михаил', 'никита', 'николай', 'олег',
    'павел', 'пётр', 'петр', 'роман', 'руслан', 'сергей', 'станислав', 'степан',
    'тимофей', 'фёдор', 'федор', 'филипп', 'эдуард', 'юрий', 'ярослав',
    // Short forms
    'саша', 'лёша', 'леша', 'паша', 'коля', 'миша', 'дима', 'вова', 'толя', 'костя',
    'витя', 'гена', 'жора', 'сеня', 'боря', 'ваня', 'петя', 'гриша', 'рома',
]);

const femaleNames = new Set([
    'александра', 'алёна', 'алена', 'алина', 'алла', 'анастасия', 'ангелина', 'анжела',
    'анна', 'валентина', 'валерия', 'варвара', 'вера', 'вероника', 'виктория', 'галина',
    'дарья', 'диана', 'евгения', 'екатерина', 'елена', 'елизавета', 'жанна', 'зоя',
    'инна', 'ирина', 'карина', 'кира', 'кристина', 'ксения', 'лариса', 'лидия',
    'любовь', 'людмила', 'маргарита', 'марина', 'мария', 'милана', 'надежда', 'наталья',
    'нина', 'оксана', 'ольга', 'полина', 'раиса', 'светлана', 'софия', 'софья',
    'тамара', 'татьяна', 'ульяна', 'юлия', 'яна',
    // Short forms
    'настя', 'аня', 'катя', 'лена', 'лиза', 'маша', 'даша', 'наташа', 'таня', 'оля',
    'света', 'юля', 'вика', 'ира', 'надя', 'соня', 'саша', 'женя', 'вера',
]);

// Names that can be both (unisex)
const unisexNames = new Set(['саша', 'женя', 'валя', 'слава', 'никита']);

export type Gender = 'male' | 'female' | 'unknown';

export interface GenderResult {
    gender: Gender;
    confidence: number; // 0.0 - 1.0
    method: 'name_exact' | 'name_ending' | 'unknown';
}

/**
 * Detect gender from a Russian name
 * Returns gender with confidence score
 */
export function detectGenderFromName(fullName: string): GenderResult {
    if (!fullName || typeof fullName !== 'string') {
        return { gender: 'unknown', confidence: 0, method: 'unknown' };
    }

    // Extract first name — handles both "Имя Фамилия" and the official
    // "Фамилия Имя Отчество" order, not just the first word.
    const firstName = extractFirstName(fullName)?.toLowerCase();

    if (!firstName) {
        return { gender: 'unknown', confidence: 0, method: 'unknown' };
    }

    // Check unisex names first
    if (unisexNames.has(firstName)) {
        return { gender: 'unknown', confidence: 0, method: 'unknown' };
    }

    // Check exact matches
    if (maleNames.has(firstName)) {
        return { gender: 'male', confidence: 0.95, method: 'name_exact' };
    }

    if (femaleNames.has(firstName)) {
        return { gender: 'female', confidence: 0.95, method: 'name_exact' };
    }

    // Fallback: check name endings (heuristic)
    // Russian female names often end in -а, -я, -ия
    // Male names often end in consonants or -й, -ь
    const lastTwoChars = firstName.slice(-2);
    const lastChar = firstName.slice(-1);

    // Female endings
    if (['ия', 'ья', 'ея', 'ая', 'яя'].includes(lastTwoChars)) {
        return { gender: 'female', confidence: 0.75, method: 'name_ending' };
    }

    if (['а', 'я'].includes(lastChar) && !['ша', 'ха', 'ча', 'ща'].some(e => firstName.endsWith(e) && firstName.length <= 4)) {
        return { gender: 'female', confidence: 0.7, method: 'name_ending' };
    }

    // Male endings
    if (['й', 'н', 'р', 'м', 'в', 'д', 'г', 'л'].includes(lastChar)) {
        return { gender: 'male', confidence: 0.65, method: 'name_ending' };
    }

    if (lastChar === 'ь') {
        // Could be either (Игорь = male, Любовь = female), lower confidence
        return { gender: 'unknown', confidence: 0, method: 'unknown' };
    }

    return { gender: 'unknown', confidence: 0, method: 'unknown' };
}

/**
 * Get emoji for gender display
 */
export function getGenderEmoji(gender: Gender): string {
    switch (gender) {
        case 'male': return '♂️';
        case 'female': return '♀️';
        default: return '';
    }
}

/**
 * Get label for gender display
 */
export function getGenderLabel(gender: Gender): string {
    switch (gender) {
        case 'male': return 'Мужской';
        case 'female': return 'Женский';
        default: return 'Неизвестно';
    }
}
