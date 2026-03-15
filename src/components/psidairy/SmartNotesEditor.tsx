'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    Plus, Trash2, ChevronDown, ChevronUp, Lock, UserCircle, Sparkles,
    FileText, GripVertical
} from 'lucide-react';
import {
    SmartBlock, SmartBlockDefinition, SmartBlockField,
    SMART_BLOCK_DEFINITIONS, SESSION_TEMPLATES,
    getDefinitionById, createBlockInstance
} from '@/lib/smart-notes/config';

// ============================================================
// Types
// ============================================================

export type SmartNotesData = {
    blocks: SmartBlock[];
    privateNotes: string;
    clientSummary: string;
};

type SmartNotesEditorProps = {
    initialData?: SmartNotesData;
    onChange: (data: SmartNotesData) => void;
    isFirstSession?: boolean;
};

// ============================================================
// Block Field Renderer
// ============================================================

function BlockFieldInput({ field, value, onChange }: {
    field: SmartBlockField;
    value: string;
    onChange: (val: string) => void;
}) {
    if (field.type === 'select' && field.options) {
        return (
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring/50 focus:outline-none transition-all"
            >
                <option value="">—</option>
                {field.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    if (field.type === 'textarea') {
        return (
            <textarea
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                rows={2}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus:ring-2 focus:ring-ring/50 focus:outline-none transition-all placeholder:text-muted-foreground/50"
            />
        );
    }

    return (
        <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring/50 focus:outline-none transition-all placeholder:text-muted-foreground/50"
        />
    );
}

// ============================================================
// Single Block Card
// ============================================================

function SmartBlockCard({ block, definition, onUpdate, onRemove }: {
    block: SmartBlock;
    definition: SmartBlockDefinition;
    onUpdate: (blockId: string, values: Record<string, string>) => void;
    onRemove: (blockId: string) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    const handleFieldChange = useCallback((fieldKey: string, value: string) => {
        onUpdate(block.id, { ...block.values, [fieldKey]: value });
    }, [block.id, block.values, onUpdate]);

    const filledCount = definition.fields.filter(f => block.values[f.key]?.trim()).length;

    return (
        <div className={`rounded-2xl border-2 overflow-hidden transition-all ${definition.color}`}>
            {/* Header */}
            <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="text-lg">{definition.emoji}</span>
                <span className="text-sm font-bold flex-1">{definition.label}</span>
                <span className="text-xs font-medium opacity-60">
                    {filledCount}/{definition.fields.length}
                </span>
                <button
                    onClick={e => { e.stopPropagation(); onRemove(block.id); }}
                    className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                    title="Удалить блок"
                >
                    <Trash2 className="w-3.5 h-3.5 opacity-50" />
                </button>
                {collapsed ? (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                ) : (
                    <ChevronUp className="w-4 h-4 opacity-50" />
                )}
            </div>

            {/* Fields */}
            {!collapsed && (
                <div className="px-4 pb-4 space-y-3 bg-background/80">
                    {definition.fields.map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-semibold mb-1 text-foreground/70">
                                {field.label}
                                {field.required && <span className="text-destructive ml-0.5">*</span>}
                            </label>
                            <BlockFieldInput
                                field={field}
                                value={block.values[field.key] || ''}
                                onChange={val => handleFieldChange(field.key, val)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// Quick Tag Chips (top bar)
// ============================================================

function QuickTagChips({ onAdd, existingBlockIds }: {
    onAdd: (definitionId: string) => void;
    existingBlockIds: string[];
}) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const coreBlocks = SMART_BLOCK_DEFINITIONS.filter(d => d.category === 'basic');

    return (
        <div className="flex flex-wrap gap-1.5 relative">
            {coreBlocks.map(def => {
                const isUsed = existingBlockIds.includes(def.id);
                return (
                    <button
                        key={def.id}
                        type="button"
                        onClick={() => onAdd(def.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                            isUsed
                                ? 'bg-primary/15 text-primary border border-primary/30'
                                : 'bg-muted hover:bg-muted-foreground/10 text-muted-foreground border border-transparent'
                        }`}
                    >
                        <span>{def.emoji}</span>
                        <span>{def.label}</span>
                        {isUsed && <span className="opacity-50">+</span>}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================
// Template Selector
// ============================================================

function TemplateSelector({ onSelect }: { onSelect: (blockIds: string[]) => void }) {
    return (
        <div className="flex gap-2 flex-wrap">
            {SESSION_TEMPLATES.map(tmpl => (
                <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => onSelect(tmpl.blockIds)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    {tmpl.label}
                </button>
            ))}
        </div>
    );
}

// ============================================================
// Main Editor
// ============================================================

export function SmartNotesEditor({ initialData, onChange, isFirstSession }: SmartNotesEditorProps) {
    const [blocks, setBlocks] = useState<SmartBlock[]>(initialData?.blocks || []);
    const [privateNotes, setPrivateNotes] = useState(initialData?.privateNotes || '');
    const [clientSummary, setClientSummary] = useState(initialData?.clientSummary || '');
    const [activeTab, setActiveTab] = useState<'blocks' | 'private' | 'client'>('blocks');
    const [templateUsed, setTemplateUsed] = useState(false);

    // Emit changes
    const emitChange = useCallback((
        newBlocks: SmartBlock[],
        newPrivate: string,
        newClient: string
    ) => {
        onChange({ blocks: newBlocks, privateNotes: newPrivate, clientSummary: newClient });
    }, [onChange]);

    const addBlock = useCallback((definitionId: string) => {
        const newBlock = createBlockInstance(definitionId);
        const updated = [...blocks, newBlock];
        setBlocks(updated);
        emitChange(updated, privateNotes, clientSummary);
    }, [blocks, privateNotes, clientSummary, emitChange]);

    const removeBlock = useCallback((blockId: string) => {
        const updated = blocks.filter(b => b.id !== blockId);
        setBlocks(updated);
        emitChange(updated, privateNotes, clientSummary);
    }, [blocks, privateNotes, clientSummary, emitChange]);

    const updateBlock = useCallback((blockId: string, values: Record<string, string>) => {
        const updated = blocks.map(b => b.id === blockId ? { ...b, values } : b);
        setBlocks(updated);
        emitChange(updated, privateNotes, clientSummary);
    }, [blocks, privateNotes, clientSummary, emitChange]);

    const applyTemplate = useCallback((blockIds: string[]) => {
        const newBlocks = blockIds.map(id => createBlockInstance(id));
        setBlocks(newBlocks);
        setTemplateUsed(true);
        emitChange(newBlocks, privateNotes, clientSummary);
    }, [privateNotes, clientSummary, emitChange]);

    const handlePrivateChange = useCallback((val: string) => {
        setPrivateNotes(val);
        emitChange(blocks, val, clientSummary);
    }, [blocks, clientSummary, emitChange]);

    const handleClientChange = useCallback((val: string) => {
        setClientSummary(val);
        emitChange(blocks, privateNotes, val);
    }, [blocks, privateNotes, emitChange]);

    const existingDefIds = blocks.map(b => b.definitionId);

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
                <button
                    type="button"
                    onClick={() => setActiveTab('blocks')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'blocks'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <FileText className="w-3.5 h-3.5" />
                    Заметки
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('private')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'private'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Lock className="w-3.5 h-3.5" />
                    Приватные
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('client')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === 'client'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <UserCircle className="w-3.5 h-3.5" />
                    Для клиента
                </button>
            </div>

            {/* Blocks Tab */}
            {activeTab === 'blocks' && (
                <div className="space-y-4">
                    {/* Template suggestion if no blocks */}
                    {blocks.length === 0 && !templateUsed && (
                        <div className="text-center py-6 space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Выберите шаблон или добавьте блоки:
                            </p>
                            <TemplateSelector onSelect={applyTemplate} />
                        </div>
                    )}

                    {/* Quick Tag Chips */}
                    <QuickTagChips onAdd={addBlock} existingBlockIds={existingDefIds} />

                    {/* Block cards */}
                    <div className="space-y-3">
                        {blocks.map(block => {
                            const def = getDefinitionById(block.definitionId);
                            if (!def) return null;
                            return (
                                <SmartBlockCard
                                    key={block.id}
                                    block={block}
                                    definition={def}
                                    onUpdate={updateBlock}
                                    onRemove={removeBlock}
                                />
                            );
                        })}
                    </div>

                    {/* Post-session gentle hints */}
                    {blocks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {!existingDefIds.includes('dynamics') && !isFirstSession && (
                                <button
                                    type="button"
                                    onClick={() => addBlock('dynamics')}
                                    className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    💡 Добавить динамику?
                                </button>
                            )}
                            {!existingDefIds.includes('next_step') && (
                                <button
                                    type="button"
                                    onClick={() => addBlock('next_step')}
                                    className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    💡 Добавить следующий шаг?
                                </button>
                            )}
                            {!existingDefIds.includes('homework') && (
                                <button
                                    type="button"
                                    onClick={() => addBlock('homework')}
                                    className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    💡 Добавить ДЗ?
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Private Notes Tab */}
            {activeTab === 'private' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="font-medium">Только для вас, клиент не увидит</span>
                    </div>
                    <textarea
                        value={privateNotes}
                        onChange={e => handlePrivateChange(e.target.value)}
                        rows={8}
                        placeholder="Рабочие гипотезы, наблюдения, заметки для супервизии..."
                        className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background resize-none text-sm transition-all placeholder:text-muted-foreground/50"
                    />
                </div>
            )}

            {/* Client Summary Tab */}
            {activeTab === 'client' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserCircle className="w-3.5 h-3.5" />
                        <span className="font-medium">Видно клиенту в его кабинете</span>
                    </div>
                    <textarea
                        value={clientSummary}
                        onChange={e => handleClientChange(e.target.value)}
                        rows={6}
                        placeholder="Краткое резюме: что обсудили, договорённости, план..."
                        className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background resize-none text-sm transition-all placeholder:text-muted-foreground/50"
                    />
                </div>
            )}
        </div>
    );
}
