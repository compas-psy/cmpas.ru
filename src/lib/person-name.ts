// Извлекает имя для обращения из значений в формате "Имя Фамилия" или
// официальном "Фамилия Имя Отчество". Слепое взятие первого токена даёт
// фамилию для большинства российских ФИО — сначала проверяем словарь
// распространённых имён, затем морфологию отчества/фамилии, и только потом
// откатываемся на первый токен (для нероссийских имён).
// Портировано из android/.../presentation/util/PersonName.kt — держите в
// синхроне при правках.

const COMMON_GIVEN_NAMES = new Set([
    'август', 'авдей', 'адам', 'адриан', 'азамат', 'аким', 'алан', 'александр',
    'алексей', 'али', 'алёна', 'алевтина', 'алина', 'алиса', 'алла', 'альберт',
    'альбина', 'амир', 'анастасия', 'анатолий', 'ангелина', 'андрей', 'анна',
    'антон', 'антонина', 'аркадий', 'арсен', 'арсений', 'артём', 'артемий',
    'арина', 'вадим', 'валентин', 'валентина', 'валерий', 'валерия', 'варвара',
    'василий', 'василиса', 'вера', 'вероника', 'виктор', 'виктория', 'виталий',
    'влад', 'владимир', 'владислав', 'владлена', 'всеволод', 'вячеслав', 'галина',
    'геннадий', 'георгий', 'герман', 'глеб', 'григорий', 'давид', 'даниил',
    'данил', 'данила', 'дарья', 'демид', 'денис', 'диана', 'дмитрий', 'ева',
    'евгений', 'евгения', 'егор', 'екатерина', 'елена', 'елизавета', 'жанна',
    'захар', 'злата', 'зоя', 'иван', 'игорь', 'илья', 'инна', 'ирина',
    'карина', 'кира', 'кирилл', 'клавдия', 'константин', 'ксения', 'лариса',
    'лев', 'леонид', 'лидия', 'лилия', 'любовь', 'людмила', 'макар', 'максим',
    'марк', 'маргарита', 'марина', 'мария', 'матвей', 'михаил', 'надежда',
    'наталья', 'никита', 'николай', 'нина', 'оксана', 'олег', 'олеся', 'ольга',
    'павел', 'пётр', 'полина', 'раиса', 'регина', 'ренат', 'римма', 'роберт',
    'родион', 'роман', 'ростислав', 'руслан', 'савва', 'святослав', 'светлана',
    'семён', 'сергей', 'снежана', 'софия', 'станислав', 'степан', 'таисия',
    'тамара', 'татьяна', 'тимофей', 'тимур', 'ульяна', 'фёдор', 'юлия', 'юрий',
    'яна', 'ярослав', 'ярослава',
]);

const PATRONYMIC_ENDINGS = ['ович', 'евич', 'ич', 'оглы', 'улы', 'овна', 'евна', 'ична', 'кызы'];

const SURNAME_ENDINGS = [
    'ов', 'ев', 'ёв', 'ин', 'ын', 'ова', 'ева', 'ёва', 'ина', 'ына',
    'ский', 'цкий', 'ской', 'ская', 'цкая', 'ко', 'енко', 'ук',
    'юк', 'чук', 'вич', 'ич', 'дзе', 'швили', 'ян', 'янц', 'оглу',
];

function normalise(token: string): string {
    return token.toLowerCase();
}

function displayCase(token: string): string {
    return token
        .toLowerCase()
        .split('-')
        .map(part => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
        .join('-');
}

function looksLikePatronymic(token: string): boolean {
    const value = normalise(token);
    return PATRONYMIC_ENDINGS.some(ending => value.endsWith(ending));
}

function looksLikeSurname(token: string): boolean {
    const value = normalise(token);
    return value.length >= 4 && SURNAME_ENDINGS.some(ending => value.endsWith(ending));
}

/** Given "Мартынов Илья Сергеевич" (or "Илья Мартынов") returns "Илья". */
export function extractFirstName(raw: string | null | undefined): string | null {
    const tokens = (raw || '')
        .trim()
        .split(/[\s,;]+/)
        .map(t => t.replace(/^[^\p{L}-]+|[^\p{L}-]+$/gu, ''))
        .filter(t => t.length > 0);

    if (tokens.length === 0) return null;
    if (tokens.length === 1) return displayCase(tokens[0]);

    const dictionaryHit = tokens.find(t => COMMON_GIVEN_NAMES.has(normalise(t)));
    if (dictionaryHit) return displayCase(dictionaryHit);

    const patronymicIndex = tokens.findIndex(looksLikePatronymic);
    if (patronymicIndex > 0) return displayCase(tokens[patronymicIndex - 1]);

    if (tokens.length === 2) {
        const firstLooksSurname = looksLikeSurname(tokens[0]);
        const secondLooksSurname = looksLikeSurname(tokens[1]);
        if (firstLooksSurname && !secondLooksSurname) return displayCase(tokens[1]);
        if (secondLooksSurname && !firstLooksSurname) return displayCase(tokens[0]);
        return displayCase(tokens[0]);
    }

    return displayCase(tokens[0]);
}
