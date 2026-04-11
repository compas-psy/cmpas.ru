'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Check, Users, Clock, Bot, Sparkles } from 'lucide-react';

type State = {
    loaded: boolean;
    clientsCount: number;
    availabilityCount: number;
    botConnected: boolean;
};

const DISMISS_KEY = 'compas_welcome_dismissed_v1';

export function WelcomeStrip() {
    const [state, setState] = useState<State>({
        loaded: false,
        clientsCount: 0,
        availabilityCount: 0,
        botConnected: false,
    });
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        // Never show on server / first render — avoid flash
        try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) : null;
            setDismissed(stored === '1');
        } catch {
            setDismissed(false);
        }

        (async () => {
            try {
                const res = await fetch('/api/onboarding/progress', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setState({
                        loaded: true,
                        clientsCount: data.clientsCount ?? 0,
                        availabilityCount: data.availabilityCount ?? 0,
                        botConnected: !!data.botConnected,
                    });
                } else {
                    setState(s => ({ ...s, loaded: true }));
                }
            } catch {
                setState(s => ({ ...s, loaded: true }));
            }
        })();
    }, []);

    const handleDismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            /* silent */
        }
        setDismissed(true);
    };

    if (!state.loaded || dismissed) return null;

    const steps = [
        {
            key: 'clients',
            label: 'Добавить клиентов',
            href: '/diary/clients',
            icon: Users,
            done: state.clientsCount > 0,
        },
        {
            key: 'schedule',
            label: 'Настроить расписание',
            href: '/diary/availability',
            icon: Clock,
            done: state.availabilityCount > 0,
        },
        {
            key: 'bot',
            label: 'Telegram-бот',
            description: 'Уведомления о записях',
            href: '/diary/integrations',
            icon: Bot,
            done: state.botConnected,
        },
    ];

    const allDone = steps.every(s => s.done);
    if (allDone) {
        // Auto-hide once all three are done; dismiss for next visits
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            /* silent */
        }
        return null;
    }

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
                    <h2 className="font-bold text-foreground text-base md:text-lg">Добро пожаловать в КОМПАС</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Три шага — и кабинет готов к работе.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                                {('description' in step) && step.description && (
                                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{(step as any).description}</div>
                                )}
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
