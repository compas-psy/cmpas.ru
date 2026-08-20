'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/app/admin/panel/actions';

/**
 * Ввод ручного значения прямо в том блоке, который его показывает.
 * Отдельного экрана под ручные значения нет намеренно (ТЗ §11).
 */
function useSubmit(action: (data: FormData) => Promise<ActionResult>) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setDone(false);

        const data = new FormData(event.currentTarget);
        try {
            const result = await action(data);
            if (!result.ok) {
                setError(result.error ?? 'Не сохранилось');
                return;
            }
            setDone(true);
            startTransition(() => router.refresh());
        } catch {
            setError('Не сохранилось: нет доступа или связи с базой');
        }
    }

    return { submit, pending, error, done };
}

const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 10,
    border: '1px solid var(--p-border)',
    background: 'var(--p-card)',
    color: 'var(--p-ink)',
    font: 'inherit',
    fontSize: 13,
    minWidth: 0,
    width: '100%',
};

const buttonStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: 12,
    border: '1px solid var(--p-primary)',
    background: 'var(--p-primary)',
    color: 'var(--p-primary-ink)',
    font: 'inherit',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

function Feedback({ error, done, pending }: { error: string | null; done: boolean; pending: boolean }) {
    if (error) return <span style={{ fontSize: 11.5, color: 'var(--se-fg)' }}>{error}</span>;
    if (done && !pending) return <span style={{ fontSize: 11.5, color: 'var(--ok-fg)' }}>Сохранено</span>;
    return null;
}

/** Дата последнего учебного восстановления копии. */
export function BackupDrillForm({ current }: { current: string | null }) {
    const { submit, pending, error, done } = useSubmit(
        // Импорт внутрь, чтобы серверный экшен не утягивал в клиент лишнего.
        async (data) => (await import('@/app/admin/panel/actions')).setBackupDrill(data),
    );

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <label htmlFor="drillAt" style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>
                Отметить проведённое восстановление
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                    id="drillAt"
                    name="drillAt"
                    type="date"
                    defaultValue={current ? current.slice(0, 10) : ''}
                    max={new Date().toISOString().slice(0, 10)}
                    style={{ ...inputStyle, width: 'auto', flex: '1 1 150px' }}
                />
                <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.6 : 1 }}>
                    {pending ? 'Сохраняю…' : 'Сохранить'}
                </button>
            </div>
            <Feedback error={error} done={done} pending={pending} />
            <span style={{ fontSize: 11, color: 'var(--p-sub)' }}>
                Пустое поле снимает отметку — карточка снова перестанет быть зелёной.
            </span>
        </form>
    );
}

/** Статьи расхода на инфраструктуру. */
export function InfraCostForm({
    current,
}: {
    current: { server: number | null; storage: number | null; domains: number | null } | null;
}) {
    const { submit, pending, error, done } = useSubmit(
        async (data) => (await import('@/app/admin/panel/actions')).setInfraCost(data),
    );

    const fields = [
        { name: 'server', label: 'Сервер', value: current?.server },
        { name: 'storage', label: 'Хранилище копий', value: current?.storage },
        { name: 'domains', label: 'Домены', value: current?.domains },
    ];

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>Ввести суммы, ₽ в месяц</span>
            {fields.map((f) => (
                <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label htmlFor={f.name} style={{ fontSize: 12.5, color: 'var(--p-muted)', flex: '0 0 130px' }}>
                        {f.label}
                    </label>
                    <input
                        id={f.name}
                        name={f.name}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        defaultValue={f.value ?? ''}
                        placeholder="—"
                        style={inputStyle}
                    />
                </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" disabled={pending} style={{ ...buttonStyle, opacity: pending ? 0.6 : 1 }}>
                    {pending ? 'Сохраняю…' : 'Сохранить'}
                </button>
                <Feedback error={error} done={done} pending={pending} />
            </div>
        </form>
    );
}
