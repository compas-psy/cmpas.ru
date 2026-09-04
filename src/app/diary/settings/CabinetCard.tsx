'use client';

import { useState } from 'react';
import { Check, MapPin, Pencil, X } from 'lucide-react';
import AddressAutocomplete from '@/components/ui/address-autocomplete';

export type Cabinet = {
    id: string;
    name: string;
    address: string;
    isPrimary?: boolean;
    isActive?: boolean;
};

/**
 * Карточка кабинета (Задача 18 §4): название, адрес, признак основного и
 * редактирование — всё видимое, без наведения мышью и без «⋮».
 *
 * «Убрать» здесь означает вывод кабинета из работы, а не удаление: у
 * прошедших сессий место встречи должно остаться. Выведенный кабинет
 * показывается приглушённым и его можно вернуть.
 */
export function CabinetCard({
    cabinet,
    onSetPrimary,
    onSave,
    onDeactivate,
    onActivate,
}: {
    cabinet: Cabinet;
    onSetPrimary: (id: string) => void;
    onSave: (id: string, data: { name: string; address: string }) => Promise<void> | void;
    onDeactivate: (id: string) => void;
    onActivate: (id: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ name: cabinet.name, address: cabinet.address });
    const [saving, setSaving] = useState(false);
    const isActive = cabinet.isActive !== false;

    const handleSave = async () => {
        if (!draft.name.trim() || !draft.address.trim()) return;
        setSaving(true);
        try {
            await onSave(cabinet.id, { name: draft.name.trim(), address: draft.address.trim() });
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <div data-testid="cabinet-card" className="p-4 bg-background border border-primary/40 rounded-2xl space-y-3">
                <input
                    aria-label="Название кабинета"
                    type="text"
                    value={draft.name}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <AddressAutocomplete
                    value={draft.address}
                    onChange={value => setDraft(d => ({ ...d, address: value }))}
                    className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Адрес кабинета"
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !draft.name.trim() || !draft.address.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[13px] font-bold rounded-xl hover:bg-forest-700 transition-all disabled:opacity-50"
                    >
                        <Check className="w-3.5 h-3.5" /> Сохранить
                    </button>
                    <button
                        onClick={() => { setDraft({ name: cabinet.name, address: cabinet.address }); setEditing(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 border border-border text-[13px] font-bold rounded-xl hover:bg-muted transition-all"
                    >
                        <X className="w-3.5 h-3.5" /> Отмена
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="cabinet-card"
            className={`flex justify-between items-center gap-3 p-4 bg-background border rounded-2xl ${
                cabinet.isPrimary ? 'border-primary/50 bg-primary/5' : 'border-border'
            } ${isActive ? '' : 'opacity-60'}`}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                    onClick={() => onSetPrimary(cabinet.id)}
                    disabled={!isActive || cabinet.isPrimary}
                    title={cabinet.isPrimary ? 'Основной кабинет' : 'Сделать основным'}
                    aria-label={cabinet.isPrimary ? 'Основной кабинет' : 'Сделать основным'}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        cabinet.isPrimary ? 'border-primary bg-primary' : 'border-muted-foreground/40 hover:border-primary disabled:hover:border-muted-foreground/40'
                    }`}
                >
                    {cabinet.isPrimary && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground flex items-center gap-2 flex-wrap">
                        {cabinet.name}
                        {cabinet.isPrimary
                            ? <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Основной</span>
                            : <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Не основной</span>}
                        {!isActive && <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Выведен из работы</span>}
                    </p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" /> {cabinet.address}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {isActive ? (
                    <>
                        <button
                            onClick={() => { setDraft({ name: cabinet.name, address: cabinet.address }); setEditing(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" /> Редактировать
                        </button>
                        <button
                            onClick={() => onDeactivate(cabinet.id)}
                            className="px-3 py-1.5 text-[12px] font-semibold text-muted-foreground rounded-lg hover:bg-muted hover:text-destructive transition-colors"
                        >
                            Убрать
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => onActivate(cabinet.id)}
                        className="px-3 py-1.5 text-[12px] font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                        Вернуть в работу
                    </button>
                )}
            </div>
        </div>
    );
}
