import Link from "next/link";

export default function DeepClientCard({ params }: { params: { id: string } }) {
    const clientName = "Алексей Смирнов";
    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">

            {/* Left Sidebar: Client Menu & Quick Actions */}
            <aside className="w-72 bg-white border-r border-gray-200 flex flex-col pt-6 pb-4">
                <div className="px-6 pb-6 border-b border-gray-100 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 font-bold text-2xl flex items-center justify-center mb-4">
                        АС
                    </div>
                    <h1 className="text-xl font-bold">{clientName}</h1>
                    <p className="text-sm text-gray-500 mt-1">Клиент с 12.10.2025</p>
                    <div className="flex gap-2 mt-4">
                        <Link href={`/diary/session/${params.id}`} className="w-full">
                            <button className="w-full text-xs bg-gray-900 text-white rounded-md px-3 py-2 font-medium hover:bg-gray-800 transition">Режим сессии</button>
                        </Link>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        Таймлайн (42 записи)
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z" /><path d="M18 18h-4" /><path d="M22 6M15 2H9a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z" /></svg>
                        Анамнез & Запросы
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                        Динамика (Шкалы)
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></svg>
                        Документы & Оплаты
                    </button>
                </nav>
            </aside>

            {/* Main Content: Unified Timeline */}
            <main className="flex-1 overflow-y-auto p-10">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">История работы</h2>
                        <div className="flex gap-2">
                            <button className="text-sm border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md font-medium transition">Фильтры: Все</button>
                        </div>
                    </div>

                    {/* Timeline Wrapper */}
                    <div className="relative pl-6 border-l-2 border-gray-100 space-y-10 mt-8">

                        {/* Event Type: Session */}
                        <div className="relative">
                            <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 ring-8 ring-white">
                                <svg className="w-3 h-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                            </span>
                            <div className="text-sm font-semibold text-gray-500 mb-2">Вчера, 12:00 — Онлайн</div>
                            <div className="bg-white border text-gray-800 border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg">Сессия №4</h3>
                                    <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-100 font-medium">Оплачено</span>
                                </div>

                                {/* Displaying extracted Smart Tags */}
                                <div className="space-y-3 pt-2">
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                        <span className="inline-block mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Динамика</span>
                                        <p className="text-sm leading-relaxed">Состояние стабильнее. Панические атаки не повторялись вторую неделю. Удалось соблюсти план режима сна 5 из 7 дней.</p>
                                    </div>
                                    <div className="bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                                        <span className="inline-block mb-1 text-xs font-bold text-purple-700 uppercase tracking-wider">Интервенция</span>
                                        <p className="text-sm leading-relaxed text-gray-700">Провели рескриптинг образа из детства. Клиент реагировал эмоционально, но смог закрыть гештальт. Уровень SPO2 и пульс (субъективно) нормализовались быстро.</p>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex items-center gap-4 text-xs font-medium text-gray-500">
                                    <span className="flex items-center gap-1"><svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> Домашнее задание отправлено (СМЭР)</span>
                                </div>
                            </div>
                        </div>

                        {/* Event Type: Homework Completed */}
                        <div className="relative">
                            <span className="absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-white">
                                <svg className="w-3 h-3 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                            <div className="text-sm font-semibold text-gray-500 mb-2">5 Дек, 18:30</div>
                            <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                                <h3 className="font-bold text-emerald-900 mb-1">Выполнено домашнее задание: Дневник мыслей</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">Клиент заполнил форму через Telegram MiniApp.</p>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
