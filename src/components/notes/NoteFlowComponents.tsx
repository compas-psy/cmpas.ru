'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Mic, Paperclip, Type, List, MoreVertical, Trash2, ChevronRight } from 'lucide-react';
import { NOTE_BLOCK_ICONS, IconPrivate, IconForClient, IconMic, IconAttach, IconTextFormat, IconList, IconBack, IconMoreMenu } from '@/components/icons/note-icons';
import { SmartBlock, SmartBlockDefinition, SMART_BLOCK_DEFINITIONS, getDefinitionById, createBlockInstance } from '@/lib/smart-notes/config';

// ── Types ──
export type NoteMode = 'notes' | 'private' | 'client';
export type CaptureMethod = 'brief' | 'structured' | 'voice';

export type NoteFlowData = {
  blocks: SmartBlock[];
  freeText: string;
  privateNotes: string;
  clientSummary: string;
  mode: NoteMode;
  selectedBlocks: string[];
};

// ── Segmented Control ──
export function NoteSegmentedControl({ mode, onChange }: { mode: NoteMode; onChange: (m: NoteMode) => void }) {
  return (
    <div className="note-segmented">
      <button className="note-segmented-item" data-active={mode === 'notes'} onClick={() => onChange('notes')}>Заметки</button>
      <button className="note-segmented-item" data-mode="private" data-active={mode === 'private'} onClick={() => onChange('private')}>
        <IconPrivate className="w-4 h-4" /> Приватные
      </button>
      <button className="note-segmented-item" data-mode="client" data-active={mode === 'client'} onClick={() => onChange('client')}>
        <IconForClient className="w-4 h-4" /> Для клиента
      </button>
    </div>
  );
}

// ── Block Chip ──
export function NoteBlockChip({ defId, active, onClick }: { defId: string; active: boolean; onClick: () => void }) {
  const def = getDefinitionById(defId);
  if (!def) return null;
  const Icon = NOTE_BLOCK_ICONS[def.iconId];
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full note-chip transition-all ${active ? 'bg-sage-150 text-forest-800' : 'bg-muted text-muted-foreground hover:bg-sage-100'}`}>
      {Icon && <Icon className="w-4 h-4" />}
      <span>{def.label}</span>
    </button>
  );
}

// ── Block Card (expandable) ──
export function NoteBlockCard({ block, onUpdate, onRemove }: {
  block: SmartBlock;
  onUpdate: (id: string, vals: Record<string, string>) => void;
  onRemove: (id: string) => void;
}) {
  const def = getDefinitionById(block.definitionId);
  const [collapsed, setCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!def) return null;

  const Icon = NOTE_BLOCK_ICONS[def.iconId];
  const primaryFields = def.fields.filter(f => !f.advanced);
  const advancedFields = def.fields.filter(f => f.advanced);
  const filledCount = def.fields.filter(f => block.values[f.key]?.trim()).length;

  return (
    <div className="note-card">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        {Icon && <Icon className="w-5 h-5 text-forest-800 shrink-0" />}
        <span className="note-section-title flex-1">{def.label}</span>
        <span className="text-[13px] text-muted-foreground">{filledCount}/{def.fields.length}</span>
        <button onClick={e => { e.stopPropagation(); onRemove(block.id); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </div>
      {!collapsed && (
        <div className="mt-4 space-y-4">
          {primaryFields.map(field => (
            <div key={field.key}>
              <label className="block text-[14px] font-semibold text-foreground/70 mb-1.5">{field.label}</label>
              <textarea
                value={block.values[field.key] || ''}
                onChange={e => onUpdate(block.id, { ...block.values, [field.key]: e.target.value })}
                rows={2}
                placeholder={field.placeholder}
                className="w-full px-4 py-3 text-[16px] leading-relaxed border border-border rounded-2xl bg-background resize-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700/40 outline-none transition-all placeholder:text-muted-foreground/40"
              />
            </div>
          ))}
          {advancedFields.length > 0 && (
            <>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[14px] font-semibold text-forest-700 flex items-center gap-1">
                {showAdvanced ? 'Скрыть' : 'Дополнительно'} {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showAdvanced && advancedFields.map(field => (
                <div key={field.key}>
                  <label className="block text-[14px] font-semibold text-foreground/70 mb-1.5">{field.label}</label>
                  <textarea
                    value={block.values[field.key] || ''}
                    onChange={e => onUpdate(block.id, { ...block.values, [field.key]: e.target.value })}
                    rows={2}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 text-[16px] leading-relaxed border border-border rounded-2xl bg-background resize-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700/40 outline-none transition-all placeholder:text-muted-foreground/40"
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Block Sheet ──
export function AddBlockSheet({ existingIds, onAdd, onClose }: {
  existingIds: string[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const available = SMART_BLOCK_DEFINITIONS.filter(d => !existingIds.includes(d.id));
  if (available.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 safe-area-bottom" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
        <h3 className="note-section-title mb-4">Добавить блок</h3>
        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {available.map(def => {
            const Icon = NOTE_BLOCK_ICONS[def.iconId];
            return (
              <button key={def.id} onClick={() => { onAdd(def.id); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-sage-50 transition-colors text-left">
                {Icon && <Icon className="w-5 h-5 text-forest-800 shrink-0" />}
                <div>
                  <div className="text-[16px] font-semibold text-foreground">{def.label}</div>
                  <div className="text-[14px] text-muted-foreground">{def.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Toolbar ──
export function NoteToolbar({ onMic, onAttach }: { onMic?: () => void; onAttach?: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2 py-2 border-t border-border bg-white">
      <button onClick={onAttach} className="p-2.5 rounded-xl hover:bg-muted transition-colors"><IconAttach className="w-5 h-5 text-muted-foreground" /></button>
      <button onClick={onMic} className="p-2.5 rounded-xl hover:bg-muted transition-colors"><IconMic className="w-5 h-5 text-muted-foreground" /></button>
      <button className="p-2.5 rounded-xl hover:bg-muted transition-colors"><IconTextFormat className="w-5 h-5 text-muted-foreground" /></button>
      <button className="p-2.5 rounded-xl hover:bg-muted transition-colors"><IconList className="w-5 h-5 text-muted-foreground" /></button>
    </div>
  );
}
