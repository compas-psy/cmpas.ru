/**
 * Кэш аватарок в памяти процесса.
 *
 * Зачем вообще. Список клиентов — это два десятка кружков на экране. Без
 * кэша каждое открытие списка означало бы два-три запроса к мессенджеру на
 * каждого клиента. У Telegram общий предел на бота, и упереться в него
 * значит не «аватарки грузятся медленно», а «уведомления клиентам не
 * доходят»: тот же бот и тот же лимит.
 *
 * Почему в памяти, а не в базе или на диске. Решение учредителя: фотографию
 * не хранить. Память процесса — это не хранение: она уходит при
 * перезапуске, её нет в резервных копиях и её нельзя выгрузить по запросу.
 * Кэш ограничен и по числу записей, и по времени.
 *
 * ОТСУТСТВИЕ аватарки кэшируется тоже, и это не мелочь: у человека с
 * закрытым фото каждый показ списка иначе стучался бы в мессенджер впустую.
 * Срок у «нет» короче, чем у «есть»: поставленную аватарку человек ждёт
 * увидеть скоро, а вот уже показанная от лишнего часа жизни не портится.
 */

/**
 * `note` — почему аватарки нет, если её нет.
 *
 * Причина хранится ВМЕСТЕ с записью, а не выбрасывается. Иначе в журнале
 * закэшированный промах выглядит иначе, чем свежий: 09.09 в 19:41 маршрут
 * писал «tg_no_photos», «max_no_dialog», а в 21:18 — только «empty», хотя
 * происходило ровно то же самое. Разница была не в мире, а в том, что
 * второй раз ответ пришёл из кэша и причину потеряли по дороге.
 *
 * Смотрящий в журнал не должен догадываться, что «пусто» и «пусто по такой-
 * то причине» — это одно и то же событие.
 */
export type CachedAvatar<T> = { value: T | null; expiresAt: number; note?: string };

export class AvatarCache<T> {
    private readonly entries = new Map<string, CachedAvatar<T>>();
    private readonly maxEntries: number;
    private readonly hitTtlMs: number;
    private readonly missTtlMs: number;
    private readonly now: () => number;

    constructor(opts: {
        maxEntries: number;
        hitTtlMs: number;
        missTtlMs: number;
        now?: () => number;
    }) {
        this.maxEntries = opts.maxEntries;
        this.hitTtlMs = opts.hitTtlMs;
        this.missTtlMs = opts.missTtlMs;
        this.now = opts.now ?? Date.now;
    }

    /**
     * `undefined` — записи нет или она протухла, надо идти в мессенджер.
     * `{ value: null }` — мы уже ходили и аватарки нет.
     */
    get(key: string): CachedAvatar<T> | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        // Перекладываем в конец: вытесняем то, к чему дольше всего не
        // обращались, а не то, что раньше всех положили. Иначе клиент,
        // которого открывают каждый день, вылетал бы из кэша по возрасту.
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry;
    }

    set(key: string, value: T | null, note?: string): void {
        this.entries.delete(key);
        this.entries.set(key, {
            value,
            expiresAt: this.now() + (value === null ? this.missTtlMs : this.hitTtlMs),
            note,
        });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next();
            if (oldest.done) break;
            this.entries.delete(oldest.value);
        }
    }

    /** Забыть одного клиента — например, когда он отвязал мессенджер. */
    forget(key: string): void {
        this.entries.delete(key);
    }

    get size(): number {
        return this.entries.size;
    }
}
