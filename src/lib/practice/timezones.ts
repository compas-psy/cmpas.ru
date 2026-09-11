/**
 * Часовые пояса практики — один список на настройки и на сообщения клиенту.
 *
 * Список жил в вёрстке экрана настроек, и сообщение клиенту про пояс ничего
 * не знало: «11:00» уходило без указания, чьи это одиннадцать. Клиент из
 * другого региона приходит на час-другой мимо, и виноватым выглядит сервис.
 */
export const PRACTICE_TIMEZONES: Array<{ value: string; label: string }> = [
    { value: 'Pacific/Midway', label: 'Мидуэй (GMT-11)' },
    { value: 'Pacific/Honolulu', label: 'Гавайи (GMT-10)' },
    { value: 'America/Anchorage', label: 'Аляска (GMT-9)' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (GMT-8)' },
    { value: 'America/Denver', label: 'Денвер (GMT-7)' },
    { value: 'America/Chicago', label: 'Чикаго (GMT-6)' },
    { value: 'America/New_York', label: 'Нью-Йорк (GMT-5)' },
    { value: 'America/Caracas', label: 'Каракас (GMT-4)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Буэнос-Айрес (GMT-3)' },
    { value: 'Atlantic/South_Georgia', label: 'Южная Георгия (GMT-2)' },
    { value: 'Atlantic/Azores', label: 'Азорские острова (GMT-1)' },
    { value: 'Europe/London', label: 'Лондон (GMT+0)' },
    { value: 'Europe/Berlin', label: 'Берлин (GMT+1)' },
    { value: 'Europe/Kyiv', label: 'Киев (GMT+2)' },
    { value: 'Europe/Istanbul', label: 'Стамбул (GMT+3)' },
    { value: 'Europe/Moscow', label: 'Москва (GMT+3)' },
    { value: 'Europe/Minsk', label: 'Минск (GMT+3)' },
    { value: 'Asia/Tbilisi', label: 'Тбилиси (GMT+4)' },
    { value: 'Asia/Dubai', label: 'Дубай (GMT+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (GMT+5)' },
    { value: 'Asia/Tashkent', label: 'Ташкент (GMT+5)' },
    { value: 'Asia/Almaty', label: 'Алматы (GMT+6)' },
    { value: 'Asia/Omsk', label: 'Омск (GMT+6)' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (GMT+7)' },
    { value: 'Asia/Bangkok', label: 'Бангкок (GMT+7)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (GMT+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (GMT+8)' },
    { value: 'Asia/Shanghai', label: 'Пекин, Шанхай (GMT+8)' },
    { value: 'Asia/Makassar', label: 'Бали (GMT+8)' },
    { value: 'Asia/Tokyo', label: 'Токио (GMT+9)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (GMT+9)' },
    { value: 'Australia/Sydney', label: 'Сидней (GMT+10)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (GMT+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (GMT+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (GMT+12)' },
    { value: 'Pacific/Auckland', label: 'Окленд (GMT+12)' },
];

const BY_VALUE = new Map(PRACTICE_TIMEZONES.map(tz => [tz.value, tz.label]));

/**
 * Человеческое имя пояса: «Москва (GMT+3)».
 *
 * Пояса нет в списке — отдаём само имя зоны: «Asia/Omsk» хуже «Омск
 * (GMT+6)», но честнее выдуманного города.
 */
export function timezoneLabel(timezone: string | null | undefined): string {
    const value = timezone?.trim();
    if (!value) return '';
    return BY_VALUE.get(value) ?? value;
}
