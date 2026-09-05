'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Check, Users, Clock, CalendarPlus, Share2, Sparkles, Upload } from 'lucide-react';
import type { PracticeOnboardingState } from '@/lib/practice/onboarding';

/**
 * Чек-лист настройки практики (Задача 24).
 *
 * Состояние целиком серверное и общее с приложением: шаги вычисляются из
 * настоящих данных практики, «поделиться» — по отметке о состоявшемся
 * действии, «скрыть» — по отметке на сервере. localStorage здесь больше нет
 * вовсе: раньше «скрыть» жило в браузере, и другой браузер или телефон
 * возвращали подсказку тому, кто её уже убрал.
 *
 * Шага «Telegram-бот» в чек-листе нет: он не входит в четыре продуктовых
 * шага MVP. Интеграции никуда не делись — они в своём разделе.
 */

const STEPS = [
    { key: 'client', label: 'Клиенты', description: 'Карточки людей, с которыми работаете', href: '/diary/clients', icon: Users },
    { key: 'schedule', label: 'Расписание', description: 'Часы, когда вы принимаете', href: '/diary/availability', icon: Clock },
    { key: 'session', label: 'Запись', description: 'Первая встреча в календаре', href: '/diary/calendar', icon: CalendarPlus },
    { key: 'share', label: 'Поделиться', description: 'Отдать ссылку для записи клиенту', href: '/diary/availability', icon: Share2 },
] as const;

export function WelcomeStrip() {
    const [state, setState] = useState<PracticeOnboardingState | null>(null);
    const [hidden, setHidden] = useState(false);
    /** Выбор «перенести или с нуля» уже сделан в этот заход. */
    const [entryChosen, setEntryChosen] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/onboarding/progress', { cache: 'no-store' });
            if (res.ok) setState(await res.json());
        } catch {
            /* тихо: подсказка не важнее самого кабинета */
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Полоса перерисовывается по событию успешного «поделиться» — чтобы шаг
    // закрылся сразу, без перезагрузки страницы. Событие шлёт то же место,
    // которое сообщило серверу о состоявшемся действии.
    useEffect(() => {
        const onShared = () => { void load(); };
        window.addEventListener('practice-onboarding-changed', onShared);
        return () => window.removeEventListener('practice-onboarding-changed', onShared);
    }, [load]);

    const handleDismiss = async () => {
        // Прячем сразу, но решение уходит на сервер: оно должно пережить
        // смену браузера и переустановку приложения.
        setHidden(true);
        const { dismissOnboarding } = await import('@/app/diary/actions/onboarding');
        await dismissOnboarding();
    };

    if (!state || hidden || state.dismissed || state.completed) return null;

    const steps = STEPS.map((step) => ({ ...step, done: state.steps[step.key] }));
    const left = steps.filter((s) => !s.done).length;

    return (
        <div className="relative bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5 border border-primary/20 rounded-2xl p-5 md:p-6 shadow-sm">
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors"
                title="Скрыть"
                type="button"
            >
                <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center text-accent-foreground shrink-0">
                    <Sparkles className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                    <h2 className="font-bold text-foreground text-base md:text-lg">Добро пожаловать в ПРАКТИКУ</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {`Осталось шагов до готового кабинета: ${left}.`}
                    </p>
                </div>
            </div>

            {/*
              Совсем пустой практике сначала предлагается выбор: перенести уже
              существующую или начать с нуля. «Начать с нуля» ничего не
              отмечает выполненным — просто оставляет чек-лист, по которому
              человек заводит клиентов и расписание руками.
            */}
            {state.empty && !entryChosen && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Link
                        href="/diary/clients/import-calendar"
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <Upload className="w-4 h-4" /> Перенести практику
                    </Link>
                    <button
                        type="button"
                        // «С нуля» ничего не отмечает выполненным и ничего не
                        // создаёт: выбор просто сворачивается, а чек-лист
                        // ниже остаётся — по нему человек и заводит клиентов,
                        // расписание и первую запись.
                        onClick={() => setEntryChosen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-background/60 transition-colors"
                    >
                        Начать с нуля
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                        <Link
                            key={step.key}
                            href={step.href}
                            className={`group flex items-center gap-3 p-3 md:p-4 rounded-xl border transition-all ${
                                step.done
                                    ? 'bg-primary/5 border-primary/20'
                                    : 'bg-card border-border hover:border-primary/40 hover:shadow-sm active:scale-[0.98]'
                            }`}
                        >
                            <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                    step.done
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                }`}
                            >
                                {step.done ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <Icon className="w-5 h-5" strokeWidth={1.5} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-muted-foreground">Шаг {i + 1}</div>
                                <div className={`text-sm font-semibold truncate ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {step.label}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            <div className="mt-4 text-center">
                <Link
                    href="/diary/help/start"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    Подробная инструкция →
                </Link>
            </div>
        </div>
    );
}
