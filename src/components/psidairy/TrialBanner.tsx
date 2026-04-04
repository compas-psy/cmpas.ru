'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
    const dayWord = daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней';

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800 flex-1">
                {daysLeft === 0
                    ? 'Пробный период заканчивается сегодня'
                    : `Пробный период заканчивается через ${daysLeft} ${dayWord}`}
            </span>
            <Link
                href="/billing"
                className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
            >
                Оформить подписку
            </Link>
        </div>
    );
}
