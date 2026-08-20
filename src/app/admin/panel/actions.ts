'use server';

import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { screenTag } from '@/lib/panel/cache';
import { BACKUP_DRILL_KEY, INFRA_COST_KEY } from '@/lib/panel/queries/config';

/**
 * Ручные значения панели.
 *
 * `SystemConfig` — единственная таблица, куда панель пишет (ТЗ §11), и только
 * то, что вводит человек: дату учебного восстановления копии и статьи расхода
 * на инфраструктуру. Обе величины показываются на панели, поэтому и вводятся
 * там же — отдельного экрана под них не заводится (ТЗ §11: «не добавлять
 * экраны сверх восьми»).
 *
 * Роль проверяется той же `auth()`, что и везде: server action — такая же
 * точка входа, как route handler, и layout её не закрывает.
 */
async function requirePanelAdmin(): Promise<void> {
    const session = await auth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const role = (session.user as { role?: string }).role;
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') throw new Error('Forbidden');
}

export interface ActionResult {
    ok: boolean;
    error?: string;
}

/**
 * Дата последнего учебного восстановления копии. Пока она пуста, карточка
 * «Резервные копии» не может быть зелёной ни при каких обстоятельствах.
 */
export async function setBackupDrill(formData: FormData): Promise<ActionResult> {
    await requirePanelAdmin();

    const raw = String(formData.get('drillAt') ?? '').trim();

    // Пустая строка — законный ввод: так отметка снимается обратно.
    if (raw) {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
            return { ok: false, error: 'Не разобрал дату' };
        }
        if (parsed.getTime() > Date.now()) {
            // Восстановление в будущем — это не восстановление, а план.
            return { ok: false, error: 'Дата в будущем: отмечается уже проведённая проверка' };
        }
    }

    await db.systemConfig.upsert({
        where: { key: BACKUP_DRILL_KEY },
        create: {
            key: BACKUP_DRILL_KEY,
            value: raw ? new Date(raw).toISOString() : '',
            label: 'Последнее учебное восстановление копии',
            category: 'panel',
        },
        update: { value: raw ? new Date(raw).toISOString() : '' },
    });

    revalidateTag(screenTag('tech'), 'max');
    revalidateTag(screenTag('morning'), 'max');
    return { ok: true };
}

/** Статьи расхода на инфраструктуру, рубли в месяц. */
export async function setInfraCost(formData: FormData): Promise<ActionResult> {
    await requirePanelAdmin();

    const read = (name: string): number | null | 'bad' => {
        const raw = String(formData.get(name) ?? '').trim().replace(',', '.');
        if (!raw) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) return 'bad';
        return Math.round(value);
    };

    const server = read('server');
    const storage = read('storage');
    const domains = read('domains');

    if (server === 'bad' || storage === 'bad' || domains === 'bad') {
        return { ok: false, error: 'Суммы должны быть неотрицательными числами' };
    }
    if (server === null && storage === null && domains === null) {
        return { ok: false, error: 'Заполните хотя бы одну статью' };
    }

    const payload = JSON.stringify({
        server,
        storage,
        domains,
        source: 'manual',
        updatedAt: new Date().toISOString(),
    });

    await db.systemConfig.upsert({
        where: { key: INFRA_COST_KEY },
        create: { key: INFRA_COST_KEY, value: payload, label: 'Стоимость инфраструктуры, ₽/мес', category: 'panel' },
        update: { value: payload },
    });

    revalidateTag(screenTag('money'), 'max');
    revalidateTag(screenTag('tech'), 'max');
    return { ok: true };
}
