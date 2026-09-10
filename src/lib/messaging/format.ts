/**
 * Как выглядит автоматическое сообщение.
 *
 * Решение учредителя, два правила:
 *
 *   1. БЕЗ ЭМОДЗИ. Они не авторские, а стандартные: одинаковый набор
 *      «📅⏰✅» в каждом уведомлении читается как рассылка, а не как письмо
 *      от специалиста. Вдобавок эмодзи рисует шрифт устройства — у каждой
 *      платформы свой, и то, что на одном телефоне выглядит аккуратно, на
 *      другом выглядит наклейкой.
 *   2. ССЫЛКА ПРЯЧЕТСЯ ЗА СЛОВО. Полный адрес на полторы строки уродует
 *      сообщение, а человеку не говорит ничего: «Яндекс Телемост» понятнее,
 *      чем telemost.yandex.ru/j/8123... Там, где разметки нет, ссылка
 *      выносится отдельной строкой с понятной подписью, а не вклеивается в
 *      середину предложения.
 *
 * Приём не новый: так уже был устроен buildSessionClientMessage. Здесь он
 * вынесен, чтобы им пользовались все, а не одно сообщение из полутора
 * десятков.
 */

/** Куда пойдёт текст: с разметкой или голым. */
export type MessageMode = 'html' | 'plain';

/** Экранирование для Telegram HTML (parse_mode=HTML). */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Ссылка за словом.
 *
 * В HTML — обычный якорь. В голом тексте адрес спрятать некуда, поэтому он
 * остаётся, но с подписью впереди: человек видит, КУДА ведёт ссылка, ещё до
 * того, как разберёт сам адрес.
 */
export function messageLink(url: string, label: string, mode: MessageMode = 'html'): string {
    if (mode === 'html') return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
    return `${label}: ${url}`;
}

export function bold(text: string, mode: MessageMode = 'html'): string {
    return mode === 'html' ? `<b>${escapeHtml(text)}</b>` : text;
}

/**
 * Человеческое имя видеовстречи по её адресу.
 *
 * Нужно, чтобы в сообщении стояло «Яндекс Телемост», а не адрес на полторы
 * строки. Незнакомый сервис получает нейтральную подпись — она всё равно
 * честнее голого адреса.
 */
export function onlineLinkLabel(url: string): string {
    const u = url.toLowerCase();
    if (u.includes('telemost')) return 'Яндекс Телемост';
    if (u.includes('meet.google')) return 'Google Meet';
    if (u.includes('zoom')) return 'Zoom';
    if (u.includes('teams.microsoft') || u.includes('teams.live')) return 'Microsoft Teams';
    if (u.includes('whereby')) return 'Whereby';
    if (u.includes('contour') || u.includes('ktalk') || u.includes('kontur')) return 'Контур.Толк';
    if (u.includes('jitsi')) return 'Jitsi Meet';
    if (u.includes('salute') || u.includes('sberjazz')) return 'SberJazz';
    if (u.includes('vk.com/call') || u.includes('vkvideocall')) return 'VK Звонки';
    return 'Перейти к видеовстрече';
}

/**
 * Строка «Ссылка для подключения» целиком — или пусто, если ссылки нет.
 *
 * Отдельной функцией, потому что её собирали в четырёх местах и в трёх из
 * них по-разному: где-то «🔗 Ссылка для подключения: <адрес>», где-то
 * «🔗 Подключение: <адрес>». Разнобой в письмах одному и тому же человеку
 * выглядит небрежностью.
 */
export function onlineLinkLine(url: string | null | undefined, mode: MessageMode = 'html'): string {
    if (!url) return '';
    return `Ссылка для подключения: ${messageLink(url, onlineLinkLabel(url), mode)}`;
}

/**
 * Ссылки из сообщения — в кнопки MAX.
 *
 * У MAX НЕТ разметки, но ЕСТЬ кнопки со ссылкой. htmlToPlain разворачивал
 * якорь в «подпись: адрес» — и в MAX адрес снова оказывался голым, на
 * полторы строки. Учредитель это и увидел: «ссылка опять не за словом».
 *
 * Кнопка решает ровно это: подпись видна, адрес спрятан. Поэтому ссылки
 * вынимаются ИЗ текста и уезжают кнопками, а в тексте на их месте остаётся
 * подпись — чтобы предложение не разъехалось.
 *
 * Строка, которая после подстановки состоит ровно из подписи, убирается:
 * иначе человек видел бы «Выбрать время» текстом и «Выбрать время» кнопкой
 * подряд. Ссылка посреди фразы так не убирается — там подпись несёт смысл.
 */
export type ExtractedLink = { label: string; url: string };

export function extractLinksForButtons(text: string): { text: string; links: ExtractedLink[] } {
    const links: ExtractedLink[] = [];

    let out = text.replace(/<a\s+href="([^"]*)"\s*>([\s\S]*?)<\/a>/gi, (_all, url: string, label: string) => {
        const clean = label.trim();
        const shown = clean && clean !== url ? clean : 'Открыть';
        // Один и тот же адрес не должен дать две одинаковые кнопки.
        if (!links.some(l => l.url === url)) links.push({ label: shown, url });
        return shown;
    });

    for (const link of links) {
        // Только целая строка — и только если она ровно подпись.
        out = out
            .split('\n')
            .filter(line => line.trim() !== link.label)
            .join('\n');
    }

    return { text: out.replace(/\n{3,}/g, '\n\n').trim(), links };
}

/**
 * Разметка Telegram → простой текст для MAX.
 *
 * MAX не понимает HTML: `<a href="…">Выбрать время</a>` приехал бы клиенту
 * тегами. Но сообщения у нас общие — одно и то же напоминание уходит и в
 * Telegram, и в MAX, — и сочинять каждое дважды значит однажды поправить
 * одно и забыть второе.
 *
 * Поэтому перевод стоит НА САМОЙ ОТПРАВКЕ в MAX, а не в каждом сообщении:
 * забыть его невозможно, потому что мимо неё в MAX ничего не уходит.
 *
 * Ссылка при переводе не теряется: якорь превращается в «подпись: адрес».
 * Спрятать её в MAX некуда, но подпись впереди говорит, куда она ведёт, —
 * это лучшее, что даёт канал без разметки.
 */
export function htmlToPlain(text: string): string {
    return text
        .replace(/<a\s+href="([^"]*)"\s*>([\s\S]*?)<\/a>/gi, (_all, url: string, label: string) => {
            const clean = label.trim();
            return clean && clean !== url ? `${clean}: ${url}` : url;
        })
        .replace(/<\/?(?:b|strong|i|em|u|s|code|pre)>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
