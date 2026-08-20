'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

/**
 * «Обновить» в шапке экрана: сбрасывает кеш ровно этого экрана
 * (POST на его API-маршрут → revalidateTag) и перерисовывает страницу.
 */
export function RefreshButton({ screen }: { screen: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [busy, setBusy] = useState(false);

    async function refresh() {
        setBusy(true);
        try {
            await fetch(`/api/admin/panel/${screen}`, { method: 'POST' });
        } finally {
            setBusy(false);
            startTransition(() => router.refresh());
        }
    }

    const working = busy || pending;

    return (
        <button
            type="button"
            onClick={refresh}
            disabled={working}
            data-chip
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 11px',
                border: '1px solid var(--p-border)',
                borderRadius: 999,
                background: 'var(--p-card)',
                color: 'var(--p-ink)',
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: working ? 'progress' : 'pointer',
                opacity: working ? 0.6 : 1,
                whiteSpace: 'nowrap',
                flex: 'none',
            }}
        >
            {working ? 'Обновляю…' : 'Обновить'}
        </button>
    );
}
