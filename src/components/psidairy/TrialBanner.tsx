'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { dayWord } from '@/lib/ru-plural';

/**
 * Полоса «срок заканчивается» над кабинетом.
 *
 * Раньше она всегда говорила про пробный период — потому что показывалась по
 * одному лишь числу оставшихся дней, а оно не пустое и у подписки. Значит
 * человек, оплативший месяц, в последнюю его неделю читал «пробный период
 * заканчивается» и кнопку «оформить подписку». Он её уже оформил.
 *
 * Что именно кончается, решает общее правило (computeBillingStatus), а не
 * этот экран: сюда приходит готовый ответ.
 */
export function TrialBanner({ daysLeft, mode }: { daysLeft: number; mode: 'trial' | 'subscription' }) {
    const what = mode === 'trial' ? 'Пробный период' : 'Подписка';

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800 flex-1">
                {daysLeft === 0
                    ? `${what} заканчивается сегодня`
                    : `${what} заканчивается через ${daysLeft} ${dayWord(daysLeft)}`}
            </span>
            <Link
                href="/billing"
                className="text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
            >
                {mode === 'trial' ? 'Оформить подписку' : 'Продлить'}
            </Link>
        </div>
    );
}
