'use client';

import { BarChart3, TrendingUp, Users, RefreshCw, Download, ChevronDown, Sparkles } from 'lucide-react';

export default function AnalyticsPage() {
    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Аналитика</h1>
                    <p className="text-muted-foreground text-sm mt-1">Обзор вашей практики за выбранный период</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-sage-50 transition-colors">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" /> 6 месяцев <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-sage-50 transition-colors">
                        <Download className="w-4 h-4" /> Экспорт отчёта
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Сессии', value: '—', trend: '', icon: BarChart3, color: 'text-forest-600 bg-sage-100' },
                    { label: 'Доход', value: '—', trend: '', icon: TrendingUp, color: 'text-forest-600 bg-sage-100' },
                    { label: 'Активные клиенты', value: '—', trend: '', icon: Users, color: 'text-forest-600 bg-sage-100' },
                    { label: 'Retention (30 дней)', value: '—', trend: '', icon: RefreshCw, color: 'text-forest-600 bg-sage-100' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-card">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[13px] font-semibold text-muted-foreground">{kpi.label}</span>
                            <div className={`w-8 h-8 rounded-xl ${kpi.color} flex items-center justify-center`}>
                                <kpi.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="text-[28px] font-bold text-foreground tabular-nums">{kpi.value}</div>
                        {kpi.trend && <div className="text-[12px] font-bold text-green-600 mt-1">{kpi.trend} <span className="text-muted-foreground font-medium">vs. пред. период</span></div>}
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Revenue + Sessions Chart */}
                <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-[15px] font-bold text-foreground mb-4">Доход и сессии</h2>
                    <div className="h-48 flex items-center justify-center bg-sage-50/50 rounded-xl border border-dashed border-border">
                        <div className="text-center">
                            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-[12px] text-muted-foreground">Данных пока недостаточно</p>
                        </div>
                    </div>
                </div>

                {/* Practice Composition */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-[15px] font-bold text-foreground mb-4">Состав практики</h2>
                    <div className="h-48 flex items-center justify-center bg-sage-50/50 rounded-xl border border-dashed border-border">
                        <div className="text-center">
                            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-[12px] text-muted-foreground">Данных пока недостаточно</p>
                        </div>
                    </div>
                </div>

                {/* Workload Heatmap */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-[15px] font-bold text-foreground mb-4">Нагрузка по дням и часам</h2>
                    <div className="h-48 flex items-center justify-center bg-sage-50/50 rounded-xl border border-dashed border-border">
                        <div className="text-center">
                            <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-[12px] text-muted-foreground">Данных пока недостаточно</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Retention + Self-care */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Retention Table */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-[15px] font-bold text-foreground mb-4">Retention по когортам клиентов</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-2 text-[12px] font-semibold text-muted-foreground">Когорта</th>
                                    <th className="text-center py-2 text-[12px] font-semibold text-muted-foreground">Клиентов</th>
                                    <th className="text-center py-2 text-[12px] font-semibold text-muted-foreground">Нед. 1</th>
                                    <th className="text-center py-2 text-[12px] font-semibold text-muted-foreground">Нед. 4</th>
                                    <th className="text-center py-2 text-[12px] font-semibold text-muted-foreground">Нед. 12</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground/50">Данных пока недостаточно</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Self-care */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-[15px] font-bold text-foreground mb-4">✨ Забота о себе</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Плотность недели', value: '—', optimal: '60–80%' },
                            { label: 'Кризисные сессии', value: '—', optimal: 'до 10%' },
                            { label: 'Сессий подряд без перерыва', value: '—', optimal: 'до 6' },
                            { label: 'Супервизии в месяц', value: '—', optimal: '2–4' },
                        ].map((m, i) => (
                            <div key={i} className="p-3 bg-sage-50/50 rounded-xl border border-border/50">
                                <div className="text-[12px] font-semibold text-muted-foreground mb-1">{m.label}</div>
                                <div className="text-[20px] font-bold text-foreground tabular-nums">{m.value}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">Оптимально: {m.optimal}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground/50">
                <RefreshCw className="w-3 h-3" /> Данные обновлены: только что
            </div>
        </div>
    );
}
