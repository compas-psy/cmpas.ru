'use client';

import { Sparkles, ClipboardCheck, Plus, Search, ChevronDown } from 'lucide-react';

const TOOLS = [
    { icon: '📊', title: 'PHQ-9', desc: 'Опросник депрессии', category: 'Аффективные', uses: 48 },
    { icon: '📋', title: 'GAD-7', desc: 'Опросник тревожности', category: 'Аффективные', uses: 35 },
    { icon: '🧠', title: 'MMSE', desc: 'Оценка когнитивных функций', category: 'Когнитивные', uses: 12 },
    { icon: '💬', title: 'BDI-II', desc: 'Шкала депрессии Бека', category: 'Аффективные', uses: 28 },
    { icon: '🔍', title: 'CAGE', desc: 'Скрининг зависимостей', category: 'Скрининг', uses: 8 },
    { icon: '⚖️', title: 'AUDIT', desc: 'Тест на алкогольную зависимость', category: 'Скрининг', uses: 5 },
];

export default function DiagnosticsPage() {
    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Диагностика</h1>
                    <p className="text-muted-foreground text-sm mt-1">Психодиагностические инструменты для оценки состояния клиентов</p>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-forest-700 transition-all shadow-card active:scale-[0.97]">
                    <Plus className="w-4 h-4" /> Назначить тест
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Поиск инструментов..." className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-sage-50">
                    Все категории <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TOOLS.map((t, i) => (
                    <button key={i} className="text-left bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/30 hover:shadow-card-hover transition-all group">
                        <div className="flex items-start gap-4">
                            <div className="text-2xl">{t.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{t.title}</div>
                                <div className="text-[12px] text-muted-foreground mt-0.5">{t.desc}</div>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="px-2 py-0.5 rounded-md bg-sage-100 text-[11px] font-semibold text-forest-700">{t.category}</span>
                                    <span className="text-[11px] text-muted-foreground">{t.uses} раз</span>
                                </div>
                            </div>
                            <ClipboardCheck className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Coming Soon Section */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-card text-center">
                <div className="w-16 h-16 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-forest-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Полноценная диагностика скоро</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Автоматическая отправка тестов клиентам, сбор ответов, визуализация результатов и отслеживание динамики — в разработке.
                </p>
            </div>
        </div>
    );
}
