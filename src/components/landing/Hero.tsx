import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Users, Clock, FileText, Bell, StickyNote, Layers } from 'lucide-react';

/* ── Sidebar Mockup ── */
function SidebarMock() {
    const items = [
        { icon: Layers, label: 'Сегодня', active: true },
        { icon: Calendar, label: 'Календарь' },
        { icon: Clock, label: 'Расписание' },
        { icon: Users, label: 'Клиенты' },
        { icon: StickyNote, label: 'Заметки' },
        { icon: Bell, label: 'Уведомления' },
        { icon: FileText, label: 'Документы' },
    ];
    return (
        <div className="w-[200px] bg-forest-800 rounded-l-[20px] py-6 px-4 flex flex-col gap-1 shrink-0">
            <div className="flex items-center gap-2 px-3 mb-6">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                    <Image src="/icon.png" alt="" width={18} height={18} className="rounded" />
                </div>
                <span className="text-white/90 text-[13px] font-bold tracking-wider uppercase">ПРАКТИКА</span>
            </div>
            {items.map(item => (
                <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    item.active ? 'bg-white/15 text-white font-semibold' : 'text-white/60'
                }`}>
                    <item.icon className="w-4 h-4" strokeWidth={item.active ? 2 : 1.5} />
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Dashboard Content ── */
function DashboardMock() {
    return (
        <div className="flex-1 bg-[#F7F8F4] rounded-r-[20px] p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <div className="text-[20px] font-bold text-[#142018]">Сегодня</div>
                    <div className="text-[12px] text-[#5F6C64] font-medium">Четверг, 15 мая</div>
                </div>
                <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center">
                        <Bell className="w-4 h-4 text-forest-800" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-forest-800 flex items-center justify-center text-white text-[11px] font-bold">МС</div>
                </div>
            </div>

            {/* Next session card */}
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 mb-3 shadow-[0_2px_12px_rgba(20,32,24,0.04)]">
                <div className="text-[10px] font-bold text-[#5F6C64] uppercase tracking-wider mb-2">Следующая сессия</div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-forest-800 text-[11px] font-bold">МС</div>
                        <div>
                            <div className="text-[14px] font-semibold text-[#142018]">Мария Смирнова</div>
                            <div className="text-[11px] text-[#5F6C64]">19:00 – 20:00 · Онлайн</div>
                        </div>
                    </div>
                    <div className="px-2.5 py-1 bg-sage-100 rounded-lg text-[10px] font-bold text-forest-800">через 2ч</div>
                </div>
            </div>

            {/* Today schedule */}
            <div className="bg-white rounded-2xl border border-[#E4E9E3] p-4 shadow-[0_2px_12px_rgba(20,32,24,0.04)]">
                <div className="text-[10px] font-bold text-[#5F6C64] uppercase tracking-wider mb-3">На сегодня</div>
                <div className="space-y-2.5">
                    {[
                        { time: '09:00', name: 'Анна П.', done: true },
                        { time: '11:00', name: 'Алексей В.', done: true },
                        { time: '19:00', name: 'Мария Смирнова', active: true },
                    ].map((s, i) => (
                        <div key={i} className={`flex items-center gap-3 py-1.5 ${s.done ? 'opacity-50' : ''}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-forest-800' : s.done ? 'bg-[#5F6C64]' : 'bg-[#E4E9E3]'}`} />
                            <span className="text-[12px] font-semibold text-[#5F6C64] tabular-nums w-10">{s.time}</span>
                            <span className={`text-[13px] font-medium ${s.active ? 'text-[#142018] font-semibold' : 'text-[#5F6C64]'} ${s.done ? 'line-through' : ''}`}>{s.name}</span>
                            {s.done && <span className="text-[10px] text-[#3B8F5A] font-semibold ml-auto">✓</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Phone Mockup: Client booking ── */
function ClientPhoneMock() {
    return (
        <div className="w-[180px] md:w-[200px] bg-white rounded-[24px] border-2 border-[#E4E9E3] shadow-floating overflow-hidden">
            <div className="bg-forest-800 px-4 py-3 text-center">
                <div className="text-white text-[12px] font-semibold">Запись на сессию</div>
            </div>
            <div className="p-3.5">
                <div className="text-[11px] font-bold text-[#5F6C64] mb-2">Май 2026</div>
                {/* Mini calendar */}
                <div className="grid grid-cols-7 gap-0.5 mb-3">
                    {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                        <div key={d} className="text-[8px] text-[#5F6C64] text-center font-semibold">{d}</div>
                    ))}
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                        <div key={d} className={`text-[9px] text-center py-0.5 rounded ${
                            d === 15 ? 'bg-forest-800 text-white font-bold' : d < 15 ? 'text-[#5F6C64]/40' : 'text-[#142018]'
                        }`}>{d}</div>
                    ))}
                </div>
                <div className="text-[10px] font-bold text-[#5F6C64] mb-2">Доступное время</div>
                <div className="flex gap-1.5 flex-wrap mb-3">
                    {['17:00', '18:00', '19:00'].map((t, i) => (
                        <div key={t} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border ${
                            i === 2 ? 'bg-forest-800 text-white border-forest-800' : 'border-[#E4E9E3] text-[#142018]'
                        }`}>{t}</div>
                    ))}
                </div>
                <div className="bg-forest-800 text-white text-center py-2 rounded-xl text-[11px] font-semibold">Записаться</div>
            </div>
        </div>
    );
}

/* ── Notification bubble ── */
function NotificationBubble() {
    return (
        <div className="bg-white rounded-2xl border border-[#E4E9E3] shadow-card px-4 py-3 flex items-center gap-3 w-[240px] md:w-[260px]">
            <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-forest-800 text-[10px] font-bold shrink-0">МС</div>
            <div>
                <div className="text-[11px] font-semibold text-[#142018]">Мария записалась</div>
                <div className="text-[10px] text-[#5F6C64]">15 мая в 19:00</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-forest-800 ml-auto shrink-0" />
        </div>
    );
}

export default function Hero() {
    return (
        <section className="relative pt-[96px] md:pt-[100px] pb-10 md:pb-16 overflow-hidden">
            {/* Subtle bg gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-sage-50/80 to-[#F7F8F4] pointer-events-none" />

            <div className="relative max-w-[1240px] mx-auto px-5 md:px-8">
                <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-8 min-h-[580px] lg:min-h-[640px]">
                    {/* Left: Text */}
                    <div className="flex-[46] w-full lg:max-w-[520px]">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-sage-100 rounded-full mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-forest-800" />
                            <span className="text-[12px] font-semibold text-forest-800">Умный кабинет психолога</span>
                        </div>

                        <h1 className="text-[36px] md:text-[48px] lg:text-[54px] font-bold leading-[1.1] tracking-[-0.02em] text-[#142018] mb-5">
                            Порядок в&nbsp;практике.{' '}
                            <br className="hidden md:block" />
                            Время на&nbsp;главное.{' '}
                            <br className="hidden md:block" />
                            <span className="text-forest-800">Рост без хаоса.</span>
                        </h1>

                        <p className="text-[16px] md:text-[17px] leading-[1.6] text-[#5F6C64] max-w-[440px] mb-8">
                            Клиенты сами записываются на сессии, а&nbsp;вы&nbsp;видите день, расписание, карточки клиентов и&nbsp;заметки в&nbsp;одном спокойном рабочем пространстве.
                        </p>

                        {/* CTA */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <Link
                                href="/auth"
                                className="inline-flex items-center justify-center px-7 py-3.5 bg-forest-800 text-white text-[15px] font-semibold rounded-[14px] hover:bg-forest-700 transition-all active:scale-[0.97] shadow-sm"
                            >
                                Попробовать бесплатно
                            </Link>
                            <a
                                href="#client-flow"
                                className="inline-flex items-center justify-center px-6 py-3.5 border border-[#E4E9E3] text-[15px] font-semibold text-forest-800 rounded-[14px] hover:bg-sage-50 transition-all"
                            >
                                Запись глазами клиента
                            </a>
                        </div>

                        {/* Micro text */}
                        <p className="text-[13px] text-[#5F6C64] mb-5">
                            30 дней бесплатно · Telegram и MAX · без CRM-сложности
                        </p>

                        {/* Trust chips */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                '30 дней бесплатно',
                                'Telegram и MAX',
                                'Данные под контролем',
                            ].map(chip => (
                                <div key={chip} className="px-3 py-1.5 bg-white border border-[#E4E9E3] rounded-full text-[12px] font-medium text-[#5F6C64]">
                                    {chip}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: UI Mockups */}
                    <div className="flex-[54] w-full relative flex justify-center lg:justify-end overflow-hidden">
                        <div className="relative scale-[0.65] sm:scale-[0.75] md:scale-[0.85] lg:scale-100 origin-top">
                            {/* Dashboard window */}
                            <div className="flex rounded-[20px] shadow-floating border border-[#E4E9E3] overflow-hidden w-[580px] h-[420px]">
                                <div className="hidden sm:block">
                                    <SidebarMock />
                                </div>
                                <DashboardMock />
                            </div>

                            {/* Mobile phone mockup - overlapping */}
                            <div className="absolute -bottom-8 -left-4 sm:-left-10 z-10">
                                <ClientPhoneMock />
                            </div>

                            {/* Notification */}
                            <div className="absolute -bottom-4 right-8 z-10 hidden sm:block">
                                <NotificationBubble />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
