'use client';

import { useState } from 'react';

/**
 * Кружок клиента: фотография из его мессенджера, инициалы — когда её нет.
 *
 * Фотография НЕ хранится у нас: браузер просит её у нашего маршрута, тот
 * спрашивает мессенджер и отдаёт байты, ничего не записывая (решение
 * учредителя; подробности — src/lib/clients/avatar.ts).
 *
 * ИНИЦИАЛЫ — ЭТО НОРМАЛЬНЫЙ ВИД, А НЕ АВАРИЙНЫЙ. Аватарки не будет у
 * клиента без мессенджера, у клиента, закрывшего фото настройками
 * приватности, и в те минуты, когда мессенджер недоступен. Поэтому кружок
 * с инициалами рисуется СРАЗУ и целиком, а картинка проявляется поверх
 * него, когда доедет: иначе на месте каждого такого клиента мигала бы
 * пустая дыра или сломанная картинка.
 *
 * Никаких подписей «фото не загрузилось» — специалисту это ничего не даёт,
 * а чинить там нечего.
 */
export function ClientAvatar({
    clientId,
    initials,
    className = '',
    /**
     * Отложенная загрузка: в списке из двух десятков клиентов браузер
     * запросит только те кружки, которые видно. Каждый запрос — это поход
     * нашего сервера в мессенджер, и лишние тут не бесплатны: у Telegram
     * предел общий на бота, тот же, которым уходят уведомления.
     */
    lazy = true,
}: {
    clientId: string;
    initials: string;
    className?: string;
    lazy?: boolean;
}) {
    // Состояние помнит, ЧЬЯ фотография загрузилась, а не просто «загрузилась».
    //
    // Сменился клиент — прежняя фотография больше не его, и без этой пары
    // React переиспользовал бы тот же узел: на карточке нового клиента на
    // мгновение оставалось бы лицо предыдущего. Сброс считается прямо при
    // отрисовке, а не эффектом: эффект сработал бы ПОСЛЕ первого кадра, то
    // есть ровно тогда, когда чужое лицо уже показали.
    const [shown, setShown] = useState<{ clientId: string; ok: boolean } | null>(null);
    const loaded = shown?.clientId === clientId && shown.ok;

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <span aria-hidden={loaded}>{initials}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/api/clients/${clientId}/avatar`}
                alt=""
                loading={lazy ? 'lazy' : 'eager'}
                decoding="async"
                onLoad={() => setShown({ clientId, ok: true })}
                onError={() => setShown({ clientId, ok: false })}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
}
