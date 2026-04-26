'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Share2, Clock, Lock, UserCircle } from 'lucide-react';
import { NOTE_BLOCK_ICONS, IconBack } from '@/components/icons/note-icons';
import {
  NoteBlockChip, NoteBlockCard, AddBlockSheet,
} from '@/components/notes/NoteFlowComponents';
import {
  SmartBlock, SMART_BLOCK_DEFINITIONS, createBlockInstance, getDefinitionById, sortBlocksByDefinition
} from '@/lib/smart-notes/config';

type SessionInfo = {
  id: string; clientName: string; sessionNumber: number;
  date: string; time: string; duration: number; format: string;
  notes: string | null; structuredNotes: any; privateNotes: any; clientSummary: string | null;
};

export default function NotesFlowPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);

  // Note data
  const [freeText, setFreeText] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [clientSummary, setClientSummary] = useState('');
  const [blocks, setBlocks] = useState<SmartBlock[]>([]);

  // Load session data
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
        if (data.structuredNotes?.blocks?.length) {
          setBlocks(data.structuredNotes.blocks);
        }
      } catch { toast.error('Ошибка загрузки'); }
      setLoading(false);
    })();
  }, [sessionId, router]);

  // Autosave to localStorage
  useEffect(() => {
    if (!session) return;
    const key = `note_draft_${sessionId}`;
    localStorage.setItem(key, JSON.stringify({ freeText, privateNotes, clientSummary, blocks }));
  }, [freeText, privateNotes, clientSummary, blocks, sessionId, session]);

  // Block operations
  const addBlock = useCallback((defId: string) => {
    setBlocks(prev => sortBlocksByDefinition([...prev, createBlockInstance(defId)]));
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

  return (
    <div className="min-h-screen note-surface flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted"><IconBack className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold text-foreground truncate">{session.clientName}</div>
          <div className="text-[13px] text-muted-foreground">{session.sessionNumber}-я сессия · {dateStr}, {session.time}</div>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold hover:bg-forest-700 transition-colors disabled:opacity-50">
          {saving ? '...' : 'Сохранить'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto px-4 pt-4 pb-24 space-y-6">

        {/* ── Section 1: Free text ── */}
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">Заметка</h3>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Что было самым важным в этой сессии?"
            className="w-full min-h-[140px] px-4 py-4 text-[16px] leading-relaxed border border-border rounded-2xl bg-white resize-y focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700/40 outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* ── Section 2: Block chips + cards ── */}
        <div>
          <h3 className="text-[15px] font-bold text-foreground mb-2">Структурные блоки</h3>
          {/* Always show chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {p1Blocks.map(def => (
              <NoteBlockChip key={def.id} defId={def.id} active={existingDefIds.includes(def.id)} onClick={() => {
                if (existingDefIds.includes(def.id)) {
                  // Remove block
                  const blockToRemove = blocks.find(b => b.definitionId === def.id);
                  if (blockToRemove) removeBlock(blockToRemove.id);
                } else {
                  addBlock(def.id);
                }
              }} />
            ))}
            <button onClick={() => setShowAddBlock(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-full note-chip text-forest-700 bg-sage-50 hover:bg-sage-100 transition-colors">
              + Ещё
            </button>
          </div>
          {/* Expanded block cards */}
          {blocks.length > 0 && (
            <div className="space-y-3">
              {blocks.map(block => (
                <NoteBlockCard key={block.id} block={block} onUpdate={updateBlock} onRemove={removeBlock} />
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Private notes (collapsible) ── */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-foreground list-none [&::-webkit-details-marker]:hidden">
            <Lock className="w-4 h-4 text-forest-700" />
            <span>Приватные заметки</span>
            <span className="text-[12px] text-muted-foreground font-normal ml-1">(только для вас)</span>
            <span className="ml-auto text-muted-foreground text-[12px] group-open:hidden">▸</span>
            <span className="ml-auto text-muted-foreground text-[12px] hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-2">
            <p className="text-[13px] text-muted-foreground mb-2">
              Рабочие гипотезы, заметки для супервизии. Клиент никогда не увидит.
            </p>
            <textarea
              value={privateNotes}
              onChange={e => setPrivateNotes(e.target.value)}
              placeholder="Ваши приватные мысли о сессии..."
              className="w-full min-h-[100px] px-4 py-3 text-[15px] leading-relaxed border border-forest-700/20 rounded-2xl bg-forest-800/[0.02] resize-y focus:ring-2 focus:ring-forest-700/20 outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </details>

        {/* ── Section 4: Client summary (collapsible) ── */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-foreground list-none [&::-webkit-details-marker]:hidden">
            <UserCircle className="w-4 h-4 text-amber-500" />
            <span>Резюме для клиента</span>
            <span className="text-[12px] text-muted-foreground font-normal ml-1">(будет видно клиенту)</span>
            <span className="ml-auto text-muted-foreground text-[12px] group-open:hidden">▸</span>
            <span className="ml-auto text-muted-foreground text-[12px] hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-2">
            <p className="text-[13px] text-muted-foreground mb-2">
              Краткое резюме: что обсудили, договорённости. Клиент увидит это в своём кабинете.
            </p>
            <textarea
              value={clientSummary}
              onChange={e => setClientSummary(e.target.value)}
              placeholder="Краткое резюме встречи для клиента..."
              className="w-full min-h-[100px] px-4 py-3 text-[15px] leading-relaxed border border-amber-500/20 rounded-2xl bg-amber-500/[0.02] resize-y focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </details>
      </div>

      {/* Bottom save bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-white/95 backdrop-blur-xl border-t border-border safe-area-bottom md:pl-[280px]">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={() => { toast.success('Черновик сохранён'); router.back(); }} className="flex-1 note-btn-secondary h-[48px]">
            <Clock className="w-4 h-4" /> Позже
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-[2] note-btn-primary h-[48px]">
            {saving ? 'Сохранение...' : 'Сохранить'} {!saving && <Check className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {showAddBlock && <AddBlockSheet existingIds={existingDefIds} onAdd={addBlock} onClose={() => setShowAddBlock(false)} />}
    </div>
  );
}
