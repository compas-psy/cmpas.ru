'use client';

import { FileText, Plus, Search, ChevronDown, ChevronRight, Shield, Lock, Server, Sparkles } from 'lucide-react';

const TEMPLATE_CARDS = [
    { icon: '📋', title: 'Согласие на обработку ПД', status: 'Активен', updated: '20.04.2026', uses: 132 },
    { icon: '📝', title: 'Пользовательское соглашение', status: 'Активен', updated: '15.04.2026', uses: 98 },
    { icon: '⚠️', title: 'Правила отмены', status: 'Активен', updated: '10.04.2026', uses: 76 },
    { icon: '📄', title: 'Договор', status: 'Активен', updated: '05.04.2026', uses: 54 },
    { icon: '🧾', title: 'Чек / оплата', status: 'Активен', updated: '28.03.2026', uses: 214 },
];

export default function DocumentsPage() {
    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Документы</h1>
                    <p className="text-muted-foreground text-sm mt-1">Шаблоны, подписание и юридическая безопасность в практике психолога</p>
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-forest-700 transition-all shadow-card active:scale-[0.97]">
                    <Plus className="w-4 h-4" /> Новый шаблон
                </button>
            </div>

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Поиск по шаблонам..." className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-sage-50 transition-colors">
                    Все статусы <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
            </div>

            {/* Template Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {TEMPLATE_CARDS.map((t, i) => (
                    <button key={i} className={`text-left p-4 rounded-2xl border transition-all group ${i === 0 ? 'border-primary/50 bg-primary/5 shadow-card' : 'border-border bg-card hover:border-primary/30 hover:shadow-card'}`}>
                        <div className="text-2xl mb-2">{t.icon}</div>
                        <div className="text-[13px] font-bold text-foreground mb-2 line-clamp-2">{t.title}</div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[11px] font-semibold text-green-600">{t.status}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">Обновлён {t.updated}</div>
                        <div className="text-[11px] text-muted-foreground">Использован {t.uses} раза</div>
                    </button>
                ))}
            </div>

            {/* Selected Document + Statuses */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Document Preview */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <div>
                            <h2 className="text-[15px] font-bold text-foreground">Согласие на обработку персональных данных</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1 text-[12px] text-green-600 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Активен</span>
                                <span className="text-[12px] text-muted-foreground">Обновлён 20 апреля 2026</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-bold hover:bg-forest-700 transition-all">Отправить клиенту</button>
                            <button className="px-3 py-1.5 border border-border rounded-lg text-[12px] font-semibold text-foreground hover:bg-sage-50 transition-colors">Предпросмотр</button>
                            <button className="px-3 py-1.5 border border-border rounded-lg text-[12px] font-semibold text-foreground hover:bg-sage-50 transition-colors">Дублировать</button>
                        </div>
                    </div>

                    {/* Compliance badge */}
                    <div className="px-6 py-3 bg-sage-50/50 border-b border-border flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-[13px] font-semibold text-green-700">152-ФЗ выполнено</span>
                        <span className="text-[12px] text-muted-foreground ml-2">Шаблон соответствует требованиям закона</span>
                    </div>

                    {/* Document body placeholder */}
                    <div className="p-6">
                        <div className="bg-sage-50/30 rounded-xl border border-dashed border-border p-8 text-center">
                            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-[13px] text-muted-foreground font-medium">Выберите шаблон для редактирования</p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1">Редактор с переменными и блоками появится здесь</p>
                        </div>
                    </div>
                </div>

                {/* Right sidebar */}
                <div className="space-y-5">
                    {/* Client Document Statuses */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-bold text-foreground">Статусы документов</h3>
                            <button className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">Все клиенты <ChevronDown className="w-3 h-3 inline ml-0.5" /></button>
                        </div>
                        <div className="space-y-3">
                            {[
                                { name: 'Анна Смирнова', status: 'Отправлено', color: 'text-forest-600', date: '20 апр. 2026, 11:30' },
                                { name: 'Артём Мартынов', status: 'Просматривает', color: 'text-blue-500', date: '20 апр. 2026, 09:12' },
                                { name: 'Елена Кузнецова', status: 'Подписано', color: 'text-green-600', date: '19 апр. 2026, 16:45' },
                                { name: 'Илья Петров', status: 'Истёк срок', color: 'text-red-500', date: '18 апр. 2026, 10:05' },
                            ].map((c, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-[11px] font-bold text-forest-700 uppercase shrink-0">{c.name.slice(0, 2)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-semibold text-foreground truncate">{c.name}</div>
                                        <div className="text-[11px] text-muted-foreground">{c.date}</div>
                                    </div>
                                    <span className={`text-[12px] font-bold ${c.color} shrink-0`}>{c.status}</span>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-4 pt-3 border-t border-border/50 text-[12px] font-semibold text-forest-600 hover:text-forest-800 transition-colors flex items-center justify-center gap-1">
                            Все документы клиента <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Legal Security */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
                        <h3 className="text-[14px] font-bold text-foreground mb-4">Юридическая безопасность</h3>
                        <div className="space-y-3">
                            {[
                                { icon: Shield, label: '152-ФЗ выполнено', desc: 'Шаблон соответствует требованиям закона', color: 'text-green-600' },
                                { icon: Server, label: 'Данные хранятся в РФ', desc: 'Серверы сертифицированы', color: 'text-green-600' },
                                { icon: Lock, label: 'Шифрование данных', desc: 'Защита на уровне хранения и передачи', color: 'text-green-600' },
                            ].map((s, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <s.icon className={`w-4 h-4 ${s.color} shrink-0 mt-0.5`} />
                                    <div>
                                        <div className="text-[13px] font-bold text-foreground">{s.label}</div>
                                        <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ready-made Templates from КОМПАС */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                <h2 className="text-[15px] font-bold text-foreground mb-1">Готовые шаблоны от КОМПАС</h2>
                <p className="text-[12px] text-muted-foreground mb-4">Проверенные юристами шаблоны для психологической практики.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { icon: '📷', title: 'Согласие на фото/видео', uses: 86 },
                        { icon: '📋', title: 'Информированное согласие', uses: 73 },
                        { icon: '👶', title: 'Согласие родителя (несовершеннолетний)', uses: 61 },
                        { icon: '🧾', title: 'Акт оказанных услуг', uses: 52 },
                    ].map((t, i) => (
                        <button key={i} className="text-left p-4 rounded-xl border border-border bg-sage-50/30 hover:bg-sage-50 hover:border-primary/30 transition-all">
                            <div className="text-xl mb-2">{t.icon}</div>
                            <div className="text-[12px] font-bold text-foreground mb-1 line-clamp-2">{t.title}</div>
                            <div className="text-[11px] text-muted-foreground">Использован {t.uses} раз</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
