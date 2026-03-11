import { SmartEditor } from "@/components/diary/notes/SmartEditor";

export default function SessionModePage({ params }: { params: { id: string } }) {
    // Mock data for the layout structure
    const clientName = "Алексей Смирнов";
    const timer = "42:15";

    return (
        <div className="flex flex-col h-screen bg-[#F9FAFB] text-gray-900 overflow-hidden">
            {/* Session Header */}
            <header className="flex-none h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button className="text-gray-400 hover:text-gray-700 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div>
                        <h1 className="font-semibold text-lg leading-tight">{clientName}</h1>
                        <p className="text-xs text-gray-500 font-medium">Текущая сессия (Онлайн)</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Active Therapy Goal */}
                    <div className="hidden md:flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                        <span className="text-xs font-semibold">Запрос: Снижение тревоги</span>
                    </div>

                    <div className="font-mono text-xl text-red-500 font-bold bg-red-50 px-3 py-1 rounded-md">
                        {timer}
                    </div>
                    <button className="bg-gray-900 text-white hover:bg-gray-800 transition-colors px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
                        Завершить сессию
                    </button>
                </div>
            </header>

            {/* Split View */}
            <main className="flex-1 flex overflow-hidden">

                {/* Left: Editor (Active Work Area) */}
                <section className="flex-1 max-w-3xl p-6 overflow-y-auto">
                    <SmartEditor />
                </section>

                {/* Right: Client Context (Read-only / Handoff) */}
                <aside className="w-[400px] border-l border-gray-200 bg-white hidden lg:flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Контекст клиента</h2>
                        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                            Режим экрана анкеты
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Anamnesis Card */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Анамнез</h3>
                            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 border border-gray-100 shadow-sm">
                                <p>32 года, работает в IT. В браке 5 лет. Предыдущий опыт терапии — 2 года назад (КПТ).</p>
                                <div className="mt-2 text-xs text-gray-500 font-medium">Жалобы: бессонница, навязчивые мысли.</div>
                            </div>
                        </div>

                        {/* Previous Session Summary */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Прошлая сессия (12 Дек)</h3>
                            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300"></div>
                                <p className="font-medium mb-1">Фокус: Границы на работе</p>
                                <p className="text-gray-600">Разобрали ситуацию с руководителем. Клиент осознал паттерн согласия спасателя.</p>
                            </div>
                        </div>

                        {/* Homework Status */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Домашнее задание</h3>
                            <div className="bg-yellow-50 rounded-xl p-3 text-sm border border-yellow-100 text-yellow-800 flex items-start gap-2 shadow-sm">
                                <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" /></svg>
                                <div>
                                    <p className="font-medium">Дневник СМЭР</p>
                                    <p className="text-xs text-yellow-700 mt-1 opacity-80">Клиент заполнил 2 ситуации до сессии.</p>
                                </div>
                            </div>
                        </div>

                        {/* Risks Warning */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Риски</h3>
                            <div className="bg-white border-2 flex items-center gap-2 border-green-500/20 text-green-700 rounded-xl p-3 text-sm font-medium shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Активных рисков нет
                            </div>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
