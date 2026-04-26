'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Share2, Clock } from 'lucide-react';
import { NOTE_BLOCK_ICONS, IconMic, IconBack } from '@/components/icons/note-icons';
import {
  NoteSegmentedControl, NoteBlockChip, NoteBlockCard,
  AddBlockSheet, NoteToolbar, NoteMode, NoteFlowData
} from '@/components/notes/NoteFlowComponents';
import {
  SmartBlock, SMART_BLOCK_DEFINITIONS, createBlockInstance, getDefinitionById
} from '@/lib/smart-notes/config';

type SessionInfo = {
  id: string; clientName: string; sessionNumber: number;
  date: string; time: string; duration: number; format: string;
  notes: string | null; structuredNotes: any; privateNotes: any; clientSummary: string | null;
};

// ── Step enum ──
type Step = 'start' | 'editor' | 'blocks' | 'review';

export default function NotesFlowPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>('start');
  const [mode, setMode] = useState<NoteMode>('notes');
  const [showAddBlock, setShowAddBlock] = useState(false);

  // Note data
  const [freeText, setFreeText] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [clientSummary, setClientSummary] = useState('');
  const [blocks, setBlocks] = useState<SmartBlock[]>([]);

  // Load session
  useEffect(() => {
    (async () => {
      try {
        const { getSessionForNotes } = await import('@/app/diary/actions/note-actions');
        const data = await getSessionForNotes(sessionId);
        if (!data) { toast.error('Сессия не найдена'); router.back(); return; }
        setSession(data);
        setFreeText(data.notes || '');
        setPrivateNotes(typeof data.privateNotes === 'object' ? data.privateNotes?.text || '' : data.privateNotes || '');
        setClientSummary(data.clientSummary || '');
        setBlocks(data.structuredNotes?.blocks || []);
        // Auto-skip to editor if notes exist
        if (data.notes || data.structuredNotes?.blocks?.length) setStep('editor');
      } catch { toast.error('Ошибка загрузки'); }
      setLoading(false);
    })();
  }, [sessionId, router]);

  // Autosave to localStorage
  const autosaveRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!session) return;
    const key = `note_draft_${sessionId}`;
    const draft = { freeText, privateNotes, clientSummary, blocks, mode };
    localStorage.setItem(key, JSON.stringify(draft));
  }, [freeText, privateNotes, clientSummary, blocks, mode, sessionId, session]);

  // Block operations
  const addBlock = useCallback((defId: string) => {
    setBlocks(prev => [...prev, createBlockInstance(defId)]);
  }, []);
  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);
  const updateBlock = useCallback((id: string, vals: Record<string, string>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, values: vals } : b));
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    try {
      const { saveSessionNotes } = await import('@/app/diary/actions/note-actions');
      await saveSessionNotes(sessionId, {
        notes: freeText || undefined,
        structuredNotes: blocks.length > 0 ? { blocks } : undefined,
        privateNotes: privateNotes ? { text: privateNotes } : undefined,
        clientSummary: clientSummary || undefined,
      });
      localStorage.removeItem(`note_draft_${sessionId}`);
      toast.success('Заметка сохранена');
      router.push('/diary');
    } catch { toast.error('Ошибка сохранения'); }
    setSaving(false);
  }, [session, sessionId, freeText, blocks, privateNotes, clientSummary, router]);

  if (loading) return (
    <div className="min-h-screen note-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return null;

  const dateStr = new Date(session.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const existingDefIds = blocks.map(b => b.definitionId);
  const p1Blocks = SMART_BLOCK_DEFINITIONS.filter(d => d.priority === 1);

  // ── STEP 1: Quick Start ──
  if (step === 'start') return (
    <div className="min-h-screen note-surface">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl hover:bg-muted"><IconBack className="w-5 h-5" /></button>
          <span className="note-title">После сессии</span>
        </div>

        {/* Client info */}
        <div className="note-card flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center text-[16px] font-bold text-forest-700">
            {session.clientName.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="note-client-name">{session.clientName}</div>
            <div className="note-body-secondary">{session.sessionNumber}-я сессия · {dateStr}, {session.time} · {session.duration} мин</div>
          </div>
        </div>

        {/* Capture methods */}
        <div className="mb-8">
          <div className="note-body-secondary mb-3">Как хотите зафиксировать сессию?</div>
          <div className="space-y-3">
            {[
              { method: 'brief' as const, icon: '✏️', title: 'Кратко', desc: 'Быстрая свободная запись' },
              { method: 'structured' as const, icon: '📋', title: 'Структурно', desc: 'По ключевым блокам и полям' },
              { method: 'voice' as const, icon: '🎙', title: 'Голосом', desc: 'Продиктуйте, мы распознаем текст' },
            ].map(item => (
              <button key={item.method} onClick={() => {
                if (item.method === 'structured') setStep('blocks');
                else setStep('editor');
              }} className="note-card w-full flex items-center gap-4 text-left hover:border-forest-700/30 transition-colors">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-[16px] font-semibold text-foreground">{item.title}</div>
                  <div className="text-[14px] text-muted-foreground">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recommended blocks */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="note-body-secondary">Рекомендуемые блоки</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {p1Blocks.map(def => (
              <NoteBlockChip key={def.id} defId={def.id} active={existingDefIds.includes(def.id)} onClick={() => addBlock(def.id)} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={() => setStep('editor')} className="note-btn-primary">
          Начать запись <ArrowLeft className="w-5 h-5 rotate-180" />
        </button>
        <div className="text-center text-[13px] text-muted-foreground mt-3">Черновик сохраняется автоматически</div>
      </div>
    </div>
  );

  // ── STEP 2: Editor ──
  if (step === 'editor') return (
    <div className="min-h-screen note-surface flex flex-col">
      {/* Compact header */}
      <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => setStep('start')} className="p-1.5 rounded-lg hover:bg-muted"><IconBack className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold text-foreground truncate">{session.clientName}</div>
          <div className="text-[13px] text-muted-foreground">{session.sessionNumber}-я сессия · {dateStr}, {session.time}</div>
        </div>
        <button onClick={() => setStep('blocks')} className="text-[14px] font-semibold text-forest-700 px-3 py-1.5 rounded-lg hover:bg-sage-50">Блоки →</button>
      </div>

      {/* Segmented control */}
      <div className="px-4 pt-4 pb-2">
        <NoteSegmentedControl mode={mode} onChange={setMode} />
      </div>

      {/* Block chips */}
      {mode === 'notes' && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {p1Blocks.slice(0, 6).map(def => (
              <NoteBlockChip key={def.id} defId={def.id} active={existingDefIds.includes(def.id)} onClick={() => { addBlock(def.id); setStep('blocks'); }} />
            ))}
            <button onClick={() => setShowAddBlock(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-full note-chip text-forest-700 bg-sage-50 hover:bg-sage-100 transition-colors">
              + Добавить блок
            </button>
          </div>
        </div>
      )}

      {/* Text area */}
      <div className="flex-1 px-4 pb-4">
        {mode === 'private' && (
          <div className="flex items-center gap-2 text-[13px] text-forest-700 bg-sage-50 rounded-xl px-3 py-2 mb-3">
            <IconBack className="w-4 h-4" />
            <span className="font-medium">Видите только вы</span>
          </div>
        )}
        {mode === 'client' && (
          <div className="flex items-center gap-2 text-[13px] text-amber-500 bg-amber-50 rounded-xl px-3 py-2 mb-3">
            <span className="font-medium">Будет видно клиенту</span>
          </div>
        )}
        <textarea
          value={mode === 'notes' ? freeText : mode === 'private' ? privateNotes : clientSummary}
          onChange={e => {
            const v = e.target.value;
            if (mode === 'notes') setFreeText(v);
            else if (mode === 'private') setPrivateNotes(v);
            else setClientSummary(v);
          }}
          placeholder={mode === 'notes' ? 'Что было самым важным в этой сессии?' : mode === 'private' ? 'Рабочие гипотезы, заметки для супервизии...' : 'Краткое резюме для клиента...'}
          className="w-full h-full min-h-[200px] px-4 py-4 text-[16px] leading-relaxed border border-border rounded-2xl bg-white resize-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700/40 outline-none placeholder:text-muted-foreground/40"
          autoFocus
        />
      </div>

      {/* Toolbar */}
      <NoteToolbar />

      {/* Bottom actions */}
      <div className="px-4 pb-6 pt-2 bg-white border-t border-border space-y-3 safe-area-bottom">
        <button onClick={() => setStep('review')} className="note-btn-primary">Проверить и сохранить</button>
      </div>

      {showAddBlock && <AddBlockSheet existingIds={existingDefIds} onAdd={addBlock} onClose={() => setShowAddBlock(false)} />}
    </div>
  );

  // ── STEP 3: Blocks ──
  if (step === 'blocks') return (
    <div className="min-h-screen note-surface flex flex-col">
      <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => setStep('editor')} className="p-1.5 rounded-lg hover:bg-muted"><IconBack className="w-5 h-5" /></button>
        <div className="flex-1">
          <div className="text-[16px] font-bold text-foreground">{session.clientName}</div>
          <div className="text-[13px] text-muted-foreground">{session.sessionNumber}-я сессия · {dateStr}, {session.time}</div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <NoteSegmentedControl mode={mode} onChange={setMode} />
      </div>

      <div className="flex-1 px-4 pb-4 overflow-auto space-y-4">
        {blocks.map(block => (
          <NoteBlockCard key={block.id} block={block} onUpdate={updateBlock} onRemove={removeBlock} />
        ))}
        <button onClick={() => setShowAddBlock(true)} className="note-btn-secondary">
          + Добавить блок
        </button>
      </div>

      <div className="px-4 pb-6 pt-2 bg-white border-t border-border space-y-3 safe-area-bottom">
        <button onClick={() => setStep('review')} className="note-btn-primary">Проверить и сохранить</button>
      </div>

      {showAddBlock && <AddBlockSheet existingIds={existingDefIds} onAdd={addBlock} onClose={() => setShowAddBlock(false)} />}
    </div>
  );

  // ── STEP 4: Review ──
  return (
    <div className="min-h-screen note-surface">
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('blocks')} className="p-2 -ml-2 rounded-xl hover:bg-muted"><IconBack className="w-5 h-5" /></button>
          <span className="note-title">Проверьте заметку</span>
        </div>

        {/* Session info */}
        <div className="note-card mb-4">
          <div className="text-[13px] text-muted-foreground mb-2">Сессия</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-[14px] font-bold text-forest-700">
              {session.clientName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div className="text-[16px] font-semibold">{session.clientName}</div>
              <div className="text-[14px] text-muted-foreground">{session.sessionNumber}-я сессия · {dateStr}, {session.time}</div>
            </div>
          </div>
        </div>

        {/* Mode */}
        <div className="note-card mb-4">
          <div className="text-[13px] text-muted-foreground mb-1">Режим заметки</div>
          <div className="text-[16px] font-semibold">{mode === 'notes' ? 'Заметки' : mode === 'private' ? '🔒 Приватные' : '👤 Для клиента'}</div>
        </div>

        {/* Blocks summary */}
        {blocks.length > 0 && (
          <div className="note-card mb-4">
            <div className="text-[13px] text-muted-foreground mb-2">Выбранные блоки</div>
            <div className="flex flex-wrap gap-2">
              {blocks.map(b => {
                const def = getDefinitionById(b.definitionId);
                if (!def) return null;
                return <span key={b.id} className="px-3 py-1.5 bg-sage-100 rounded-full text-[14px] font-semibold text-forest-800">{def.label}</span>;
              })}
            </div>
          </div>
        )}

        {/* Content preview */}
        {(freeText || privateNotes || clientSummary) && (
          <div className="note-card mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-muted-foreground">Краткое содержание</span>
            </div>
            <p className="note-body text-foreground/80 line-clamp-4">
              {mode === 'notes' ? freeText : mode === 'private' ? privateNotes : clientSummary}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 mt-8">
          <button onClick={handleSave} disabled={saving} className="note-btn-primary">
            {saving ? 'Сохранение...' : 'Сохранить заметку'} {!saving && <Check className="w-5 h-5" />}
          </button>
          <button className="note-btn-secondary" onClick={() => { toast.info('Скоро будет доступно'); }}>
            <Share2 className="w-4 h-4" /> Поделиться клиенту
          </button>
          <button className="note-btn-secondary" onClick={() => { toast.success('Черновик сохранён'); router.push('/diary'); }}>
            <Clock className="w-4 h-4" /> Продолжить позже
          </button>
        </div>
      </div>
    </div>
  );
}
