'use client';

import { useState, useMemo } from 'react';
import {
    Calendar,
    ChevronDown, ChevronUp, Search, Lock, UserCircle, BookOpen
} from 'lucide-react';
import { getDefinitionById, SmartBlock } from '@/lib/smart-notes/config';

// ============================================================
// Types
// ============================================================

type TimelineSession = {
    id: string;
    date: string;
    time: string;
    endTime: string | null;
    duration: number;
    type: string;
    format: string;
    status: string;
    notes: string | null;
    structuredNotes?: { blocks?: SmartBlock[] } | null;
    privateNotes?: { text?: string } | null;
    clientSummary?: string | null;
};

type TimelineEvent = {
    id: string;
    type: 'session' | 'note' | 'homework' | 'document';
    date: Date;
    data: TimelineSession;
};

type TimelineFilter = 'all' | 'sessions' | 'notes' | 'homework';

// ============================================================
// Helpers
// ============================================================

const statusLabels: Record<string, string> = {
    confirmed: 'Подтверждена', pending: 'Ожидает',
    completed: 'Завершена', cancelled: 'Отменена',
};
const statusDot: Record<string, string> = {
    confirmed: 'bg-green-500', pending: 'bg-amber-500',
    completed: 'bg-muted-foreground', cancelled: 'bg-destructive',
};

function formatSessionDate(d: Date) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
// Smart Block Preview (condensed)
// ============================================================

function SmartBlockPreview({ block }: { block: SmartBlock }) {
    const def = getDefinitionById(block.definitionId);
    if (!def) return null;

    const filledFields = def.fields.filter(f => block.values[f.key]?.trim());
    if (filledFields.length === 0) return null;

    return (
        <div className={`rounded-xl border px-3 py-2 ${def.color}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{def.emoji}</span>
                <span className="text-xs font-bold">{def.label}</span>
            </div>
            <div className="space-y-0.5">
                {filledFields.slice(0, 3).map(f => (
                    <p key={f.key} className="text-xs text-foreground/70 line-clamp-1">
                        <span className="font-medium">{f.label}:</span> {block.values[f.key]}
                    </p>
                ))}
                {filledFields.length > 3 && (
                    <p className="text-[10px] text-muted-foreground">
                        +{filledFields.length - 3} ещё
                    </p>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Timeline Session Card
// ============================================================

function TimelineSessionCard({ session, onOpenSession }: {
    session: TimelineSession;
    onOpenSession?: (session: TimelineSession) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const blocks = session.structuredNotes?.blocks || [];
    const hasPrivateNotes = !!session.privateNotes?.text?.trim();
    const hasClientSummary = !!session.clientSummary?.trim();
    const hasBlocks = blocks.length > 0;
    const hasLegacyNotes = !!session.notes?.trim();
    const hasContent = hasBlocks || hasPrivateNotes || hasClientSummary || hasLegacyNotes;

    const hasHomework = blocks.some(b => b.definitionId === 'homework');

    return (
        <div className="relative pl-8">
            {/* Timeline dot */}
            <div className={`absolute left-0 top-3 w-4 h-4 rounded-full border-2 border-background shadow-sm ${statusDot[session.status] || 'bg-border'}`} />
            {/* Line */}
            <div className="absolute left-[7px] top-7 bottom-0 w-0.5 bg-border/50" />

            <div
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => onOpenSession?.(session)}
            >
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <div className="text-sm font-bold text-foreground">
                                {session.time} · {session.duration} мин
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot[session.status]}`} />
                                {statusLabels[session.status] || session.status}
                                <span className="text-muted-foreground/50">·</span>
                                <span>{session.format === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasHomework && <BookOpen className="w-3.5 h-3.5 text-amber-500" title="Есть домашнее задание" />}
                        {hasPrivateNotes && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                        {hasClientSummary && <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                        {hasContent && (
                            <button
                                onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
                                className="p-1 rounded-lg hover:bg-muted transition-colors"
                            >
                                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded content */}
                {expanded && hasContent && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                        {/* Structured blocks preview */}
                        {hasBlocks && (
                            <div className="space-y-2">
                                {blocks.map(block => (
                                    <SmartBlockPreview key={block.id} block={block} />
                                ))}
                            </div>
                        )}

                        {/* Legacy notes */}
                        {hasLegacyNotes && !hasBlocks && (
                            <div className="text-xs text-foreground/70 bg-muted/30 rounded-xl p-3">
                                {session.notes}
                            </div>
                        )}

                        {/* Private notes indicator */}
                        {hasPrivateNotes && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                                <Lock className="w-3 h-3" />
                                <span className="font-medium">Приватная заметка</span>
                                <span className="text-foreground/60 line-clamp-1 flex-1">
                                    {session.privateNotes!.text!.slice(0, 80)}...
                                </span>
                            </div>
                        )}

                        {/* Client summary */}
                        {hasClientSummary && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2">
                                <UserCircle className="w-3 h-3 text-primary" />
                                <span className="font-medium text-primary">Резюме для клиента</span>
                                <span className="text-foreground/60 line-clamp-1 flex-1">
                                    {session.clientSummary!.slice(0, 80)}...
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// Main Timeline Component
// ============================================================

export function ClientTimeline({ sessions, onOpenSession }: {
    sessions: TimelineSession[];
    onOpenSession?: (session: any) => void;
}) {
    const [filter, setFilter] = useState<TimelineFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Build timeline events from sessions
    const events = useMemo(() => {
        let filtered = [...sessions].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Filter
        if (filter === 'notes') {
            filtered = filtered.filter(s =>
                (s.structuredNotes?.blocks?.length || 0) > 0 || s.notes?.trim()
            );
        } else if (filter === 'homework') {
            filtered = filtered.filter(s =>
                s.structuredNotes?.blocks?.some(b => b.definitionId === 'homework')
            );
        }

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(s => {
                if (s.notes?.toLowerCase().includes(q)) return true;
                if (s.clientSummary?.toLowerCase().includes(q)) return true;
                if (s.privateNotes?.text?.toLowerCase().includes(q)) return true;
                const blocks = s.structuredNotes?.blocks || [];
                return blocks.some(b =>
                    Object.values(b.values).some(v => v?.toLowerCase().includes(q))
                );
            });
        }

        return filtered;
    }, [sessions, filter, searchQuery]);

    // Group by month/year
    const grouped = useMemo(() => {
        const groups: Record<string, TimelineSession[]> = {};
        events.forEach(s => {
            const d = new Date(s.date);
            const key = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        return groups;
    }, [events]);

    const filterOptions: { value: TimelineFilter; label: string }[] = [
        { value: 'all', label: 'Все' },
        { value: 'sessions', label: 'Сессии' },
        { value: 'notes', label: 'С заметками' },
        { value: 'homework', label: 'С ДЗ' },
    ];

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Filters */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
                    {filterOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filter === opt.value
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Search toggle */}
                <button
                    onClick={() => setShowSearch(!showSearch)}
                    className={`p-2 rounded-lg transition-colors ${
                        showSearch ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                    }`}
                >
                    <Search className="w-4 h-4" />
                </button>
            </div>

            {/* Search input */}
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Поиск по заметкам, ДЗ, содержимому..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:ring-2 focus:ring-ring/50 focus:outline-none transition-all placeholder:text-muted-foreground/50"
                        autoFocus
                    />
                </div>
            )}

            {/* Stats */}
            <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{events.length} записей</span>
                <span>·</span>
                <span>
                    {events.filter(s => (s.structuredNotes?.blocks?.length || 0) > 0 || !!s.notes?.trim()).length} с заметками
                </span>
                {events.some(s => s.structuredNotes?.blocks?.some(b => b.definitionId === 'homework')) && (
                    <>
                        <span>·</span>
                        <span>
                            {events.filter(s => s.structuredNotes?.blocks?.some(b => b.definitionId === 'homework')).length} с ДЗ
                        </span>
                    </>
                )}
            </div>

            {/* Timeline */}
            {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Нет записей</p>
                    {searchQuery && (
                        <p className="text-xs mt-1">Попробуйте изменить поисковый запрос</p>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(grouped).map(([monthLabel, monthSessions]) => (
                        <div key={monthLabel}>
                            {/* Month header */}
                            <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-sm font-bold text-foreground capitalize">{monthLabel}</h3>
                                <div className="h-px bg-border flex-1" />
                                <span className="text-xs text-muted-foreground font-medium">
                                    {monthSessions.length} сесс.
                                </span>
                            </div>

                            {/* Session cards */}
                            <div className="space-y-3">
                                {monthSessions.map(session => (
                                    <div key={session.id}>
                                        {/* Date label */}
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 pl-8">
                                            {formatSessionDate(new Date(session.date))}
                                        </div>
                                        <TimelineSessionCard
                                            session={session}
                                            onOpenSession={onOpenSession}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
