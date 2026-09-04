'use client';

import { Building2, Monitor, Shuffle, X } from 'lucide-react';

export type ScheduleWindow = {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    format?: string | null;
    addressId?: string | null;
};

export type CabinetOption = { id: string; name: string; address?: string };

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/**
 * Задача 18 §1: один день недели может содержать НЕСКОЛЬКО независимых окон.
 * Понедельник 09:00–13:00 онлайн и 15:00–21:00 на Яузской — это два разных
 * правила, а не одно с 09:00 до 21:00. Поэтому окна только группируются по
 * дню и сортируются, но никогда не сливаются и не схлопываются в диапазон.
 */
export function groupWindowsByWeekday(windows: ScheduleWindow[]): Array<{ dayOfWeek: number; windows: ScheduleWindow[] }> {
    const byDay = new Map<number, ScheduleWindow[]>();
    for (const window of windows) {
        const day = byDay.get(window.dayOfWeek) ?? [];
        day.push(window);
        byDay.set(window.dayOfWeek, day);
    }
    return [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([dayOfWeek, dayWindows]) => ({
            dayOfWeek,
            windows: [...dayWindows].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }));
}

export function formatLabelOf(format?: string | null) {
    if (format === 'offline') return 'Очно';
    if (format === 'both') return 'Онлайн и очно';
    return 'Онлайн';
}

/**
 * Подпись окна берётся из самого окна: его формат и его кабинет. Ни то, ни
 * другое не восстанавливается по дню недели и не наследуется от соседнего
 * окна того же дня (Задача 18 §2).
 */
export function windowLabel(window: ScheduleWindow, cabinets: CabinetOption[] = []) {
    const parts = [`${window.startTime}–${window.endTime}`, formatLabelOf(window.format)];
    if (window.format !== 'online' && window.addressId) {
        const cabinet = cabinets.find(c => c.id === window.addressId);
        if (cabinet) parts.push(cabinet.name);
    }
    return parts.join(' · ');
}

function WindowIcon({ format }: { format?: string | null }) {
    const Icon = format === 'offline' ? Building2 : format === 'both' ? Shuffle : Monitor;
    return <Icon className="w-3 h-3 shrink-0" />;
}

/**
 * Рабочие часы правила по дням недели. Каждое окно — отдельная кнопка со
 * своим временем, форматом и кабинетом: правится и удаляется оно тоже
 * отдельно, соседнее окно того же дня при этом не трогается.
 */
export function RuleWeekSchedule({
    windows,
    cabinets,
    onEditWindow,
    onDeleteWindow,
    emptyHint = 'Рабочих часов пока нет',
}: {
    windows: ScheduleWindow[];
    cabinets: CabinetOption[];
    onEditWindow?: (window: ScheduleWindow) => void;
    onDeleteWindow?: (id: string) => void;
    emptyHint?: string;
}) {
    const days = groupWindowsByWeekday(windows);

    if (days.length === 0) {
        return <p className="text-[12px] text-muted-foreground text-center py-3 bg-muted/20 rounded-xl">{emptyHint}</p>;
    }

    return (
        <div className="space-y-1.5" data-testid="rule-week-schedule">
            {days.map(({ dayOfWeek, windows: dayWindows }) => (
                <div key={dayOfWeek} className="flex items-start gap-2" data-testid={`weekday-${dayOfWeek}`}>
                    <span className="w-8 pt-1 text-[11px] font-bold text-muted-foreground uppercase shrink-0">
                        {WEEKDAY_SHORT[dayOfWeek]}
                    </span>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {dayWindows.map(window => (
                            <span
                                key={window.id}
                                data-testid="schedule-window"
                                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-muted/30 border border-border/60 rounded-lg text-[12px] font-semibold text-foreground"
                            >
                                <WindowIcon format={window.format} />
                                {onEditWindow ? (
                                    <button
                                        type="button"
                                        onClick={() => onEditWindow(window)}
                                        className="tabular-nums hover:text-primary transition-colors"
                                        aria-label={`${WEEKDAY_FULL[window.dayOfWeek]}: ${windowLabel(window, cabinets)}`}
                                    >
                                        {windowLabel(window, cabinets)}
                                    </button>
                                ) : (
                                    <span className="tabular-nums">{windowLabel(window, cabinets)}</span>
                                )}
                                {onDeleteWindow && (
                                    <button
                                        type="button"
                                        onClick={() => onDeleteWindow(window.id)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                        aria-label={`Удалить окно ${window.startTime}–${window.endTime}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
