'use client';

import { StickyNote, Sparkles, Search, Plus, ChevronDown, Star, Lock, MoreVertical, Type, Hash, List, CheckSquare, Quote, Code, ImageIcon, Minus } from 'lucide-react';

const MOCK_NOTES = [
    { name: 'Анна Смирнова', session: '7-я сессия', time: '11:00', preview: 'Работа с тревожностью и самооценкой. Фокус на принятии себя и границ...', tags: ['Тревожность'], isActive: true, isToday: true },
    { name: 'Артём Мартынов', session: '3-я сессия', time: '13:00', preview: 'Исследование сценариев в отношениях с отцом. Появилось больше понимания...', tags: ['Отношения'], isActive: false, isToday: false, dateLabel: 'Вчера' },
    { name: 'Елена Кузнецова', session: 'ДЗ проверка', time: 'вчера', preview: 'Проверка домашнего задания. Отличная рефлексия, заметен прогресс в...', tags: ['Домашнее задание', 'Рефлексия'], isActive: false, isToday: false },
];

const BLOCK_TYPES = [
    { icon: Type, label: 'Текст', desc: 'Обычный текстовый блок' },
    { icon: Hash, label: 'Заголовок', desc: 'Заголовок секции' },
    { icon: List, label: 'Список', desc: 'Маркированный или нумерованный' },
    { icon: CheckSquare, label: 'Чек-лист', desc: 'Список дел с чекбоксами' },
    { icon: Quote, label: 'Цитата', desc: 'Выделенная цитата клиента' },
    { icon: Code, label: 'Код', desc: 'Для структурированного кода' },
    { icon: Minus, label: 'Разделитель', desc: 'Визуальный разделитель' },
    { icon: ImageIcon, label: 'Изображение', desc: 'Добавить изображение' },
];

export default function NotesPage() {
    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Заметки</h1>
                    <p className="text-muted-foreground text-sm mt-1">Профессиональные заметки по сессиям <span className="inline-flex items-center gap-1 text-accent">✨ AI-помощником</span></p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative hidden md:block">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="Поиск по заметкам..." className="pl-9 pr-4 py-2 border border-border rounded-xl bg-background text-sm w-56 focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-forest-700 transition-all shadow-card active:scale-[0.97]">
                        <Plus className="w-4 h-4" /> Новая заметка <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
                    </button>
                </div>
            </div>

            {/* Three-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[600px]">

                {/* LEFT: Notes List */}
                <div className="lg:col-span-3 bg-card border border-border rounded-2xl shadow-card overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-border space-y-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input type="text" placeholder="Поиск по заметкам..." className="w-full pl-8 pr-3 py-2 border border-border rounded-lg bg-background text-[12px] outline-none focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="px-2.5 py-1 border border-border rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-sage-50">Клиент: Все <ChevronDown className="w-3 h-3 inline ml-0.5" /></button>
                            <button className="px-2.5 py-1 border border-border rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-sage-50">Теги: Все <ChevronDown className="w-3 h-3 inline ml-0.5" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <div className="p-1.5 text-[10px] font-bold text-muted-foreground uppercase px-3 pt-3">Сегодня</div>
                        {MOCK_NOTES.filter(n => n.isToday).map((n, i) => (
                            <button key={i} className={`w-full text-left p-3 mx-1.5 rounded-xl mb-1 transition-all ${n.isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-sage-50'}`} style={{ width: 'calc(100% - 12px)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center text-[9px] font-bold text-forest-700 uppercase shrink-0">{n.name.slice(0, 2)}</div>
                                    <span className="text-[12px] font-bold text-foreground truncate">{n.name}</span>
                                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{n.time}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground line-clamp-2 ml-8">{n.preview}</div>
                                <div className="flex items-center gap-1.5 ml-8 mt-2">
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">{n.session}</span>
                                    {n.tags.map((t, j) => <span key={j} className="px-1.5 py-0.5 bg-sage-100 text-forest-700 text-[10px] font-semibold rounded">{t}</span>)}
                                </div>
                            </button>
                        ))}
                        <div className="p-1.5 text-[10px] font-bold text-muted-foreground uppercase px-3 pt-3">Вчера</div>
                        {MOCK_NOTES.filter(n => !n.isToday).map((n, i) => (
                            <button key={i} className="w-full text-left p-3 mx-1.5 rounded-xl mb-1 hover:bg-sage-50 transition-all" style={{ width: 'calc(100% - 12px)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center text-[9px] font-bold text-forest-700 uppercase shrink-0">{n.name.slice(0, 2)}</div>
                                    <span className="text-[12px] font-bold text-foreground truncate">{n.name}</span>
                                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{n.time}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground line-clamp-2 ml-8">{n.preview}</div>
                                <div className="flex items-center gap-1.5 ml-8 mt-2">
                                    {n.tags.map((t, j) => <span key={j} className="px-1.5 py-0.5 bg-sage-100 text-forest-700 text-[10px] font-semibold rounded">{t}</span>)}
                                </div>
                            </button>
                        ))}
                        <div className="p-3 text-center text-[11px] text-muted-foreground/50">3 заметки</div>
                    </div>
                </div>

                {/* CENTER: Editor */}
                <div className="lg:col-span-6 bg-card border border-border rounded-2xl shadow-card overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                        <div>
                            <h2 className="text-[15px] font-bold text-foreground">Анна Смирнова — 7-я сессия</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span className="text-[11px] text-muted-foreground">черновик сохранён</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-1.5 rounded-lg hover:bg-sage-50 text-muted-foreground"><Star className="w-4 h-4" /></button>
                            <button className="p-1.5 rounded-lg hover:bg-sage-50 text-muted-foreground"><Lock className="w-4 h-4" /></button>
                            <button className="p-1.5 rounded-lg hover:bg-sage-50 text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Editor body placeholder */}
                    <div className="flex-1 p-6 overflow-auto">
                        <div className="max-w-2xl mx-auto space-y-6">
                            {[
                                { label: '🎯 Запрос', text: 'Снизить уровень тревожности, научиться справляться с приступами паники. Повысить самооценку, принять себя и свои особенности.' },
                                { label: '👁 Наблюдение', text: 'Клиентка приходит вовремя, выглядит уставшей. Речь спокойная, но при обсуждении тревожных ситуаций учащается дыхание, напрягаются плечи.' },
                                { label: '⚡ Интервенция', text: 'Практика «Заземление 5-4-3-2-1» при тревоге. КПТ-техника «Когнитивная реструктуризация» для работы с автоматическими мыслями.' },
                                { label: '💬 Цитата', text: '«Когда я пытаюсь отдохнуть, я чувствую вину и думаю, что должна делать что-то полезное.»', isQuote: true },
                                { label: '📈 Динамика', text: 'Снижение интенсивности тревожных эпизодов с 8/10 до 5/10. Улучшение осознавания триггеров.' },
                            ].map((block, i) => (
                                <div key={i}>
                                    <div className="text-[14px] font-bold text-foreground mb-2">{block.label}</div>
                                    <p className={`text-[13px] leading-relaxed ${(block as any).isQuote ? 'border-l-4 border-primary/40 pl-4 italic text-muted-foreground' : 'text-foreground/80'}`}>
                                        {block.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 text-[12px] text-muted-foreground/40 text-center">/ введите команду или выберите блок</div>
                    </div>
                </div>

                {/* RIGHT: AI + Tags + Client */}
                <div className="lg:col-span-3 space-y-4">
                    {/* AI Assistant */}
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                        <h3 className="text-[13px] font-bold text-foreground mb-3 flex items-center gap-1.5">✨ AI-помощник</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Расшифровать запись', desc: 'Преобразовать аудио в текст' },
                                { label: 'Предложить теги', desc: 'AI предложит релевантные теги' },
                                { label: 'Сделать резюме', desc: 'Краткое содержание заметки' },
                                { label: 'Предложить интервенции', desc: 'AI рекомендации для работы' },
                            ].map((a, i) => (
                                <button key={i} className="w-full text-left p-2.5 rounded-xl border border-dashed border-border hover:border-primary/30 hover:bg-sage-50/50 transition-all group">
                                    <div className="text-[12px] font-bold text-foreground group-hover:text-primary transition-colors">{a.label}</div>
                                    <div className="text-[10px] text-muted-foreground">{a.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[13px] font-bold text-foreground">Теги</h3>
                            <button className="text-[11px] text-primary font-semibold hover:text-forest-800 flex items-center gap-1">✨ AI предложить</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {['Тревожность', 'Самооценка', 'КПТ', 'Самокритика', 'Границы'].map((t, i) => (
                                <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-lg flex items-center gap-1">
                                    {t} <button className="text-primary/50 hover:text-primary">×</button>
                                </span>
                            ))}
                            <button className="px-2 py-1 border border-dashed border-border text-[11px] text-muted-foreground rounded-lg hover:border-primary/30 hover:text-foreground">+ Добавить тэг</button>
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                        <h3 className="text-[13px] font-bold text-foreground mb-3">👤 Клиент</h3>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-[13px] font-bold text-forest-700 uppercase">АС</div>
                            <div>
                                <div className="text-[13px] font-bold text-foreground">Анна Смирнова</div>
                                <div className="text-[11px] text-muted-foreground">ID: 001 · Активный клиент</div>
                            </div>
                        </div>
                        <button className="w-full px-3 py-2 border border-border rounded-xl text-[12px] font-semibold text-forest-600 hover:bg-sage-50 transition-colors">Открыть профиль</button>
                    </div>

                    {/* Metadata */}
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                        <h3 className="text-[13px] font-bold text-foreground mb-3">Метаданные</h3>
                        <div className="space-y-2 text-[12px]">
                            {[
                                ['Дата сессии', '22 апреля 2026'],
                                ['Длительность', '50 минут'],
                                ['Формат', 'Онлайн (Zoom)'],
                                ['Создано', 'сегодня'],
                            ].map(([k, v], i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-24 shrink-0">{k}</span>
                                    <span className="font-medium text-foreground">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
