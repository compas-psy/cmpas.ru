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

export type CachedAvatar<T> = { value: T | null; expiresAt: number };

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

    set(key: string, value: T | null): void {
        this.entries.delete(key);
        this.entries.set(key, {
            value,
            expiresAt: this.now() + (value === null ? this.missTtlMs : this.hitTtlMs),
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
