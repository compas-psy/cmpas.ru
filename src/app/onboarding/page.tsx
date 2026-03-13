"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

const METHODS = [
    "КПТ (Когнитивно-поведенческая терапия)",
    "Гештальт-терапия",
    "Психоанализ",
    "Эмоционально-фокусированная терапия",
    "Экзистенциальная терапия",
    "Клиент-центрированная терапия",
    "Схема-терапия",
    "EMDR (ДПДГ)",
    "Семейная системная терапия",
    "Юнгианский анализ",
    "Транзактный анализ",
    "Телесно-ориентированная терапия",
    "Арт-терапия",
    "Сказкотерапия",
]

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        methods: [] as string[],
        customMethod: "",
        timezone: "Europe/Moscow",
        workDays: [true, true, true, true, true, false, false],
        startTime: "09:00",
        endTime: "18:00",
        defaultSessionDuration: 50,
        sessionBreak: 15,
        hasLunchBreak: false,
        lunchStartTime: "13:00",
        lunchEndTime: "14:00",
        basePrice: 0,
        cancellationHours: 24,
        cancellationFee: 50,
        cancellationText: "Отмена сессии возможна не позднее чем за 24 часа...",
    })

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Derived states
    const hasSelectedMethods = formData.methods.length > 0 || formData.customMethod.trim() !== ""

    const handleMethodToggle = (method: string) => {
        setFormData(prev => ({
            ...prev,
            methods: prev.methods.includes(method)
                ? prev.methods.filter(m => m !== method)
                : [...prev.methods, method]
        }))
    }

    const toggleWorkDay = (index: number) => {
        const newDays = [...formData.workDays]
        newDays[index] = !newDays[index]
        setFormData({ ...formData, workDays: newDays })
    }

    const nextStep = () => {
        if (step < 6) setStep(step + 1)
    }

    const prevStep = () => {
        if (step > 1) setStep(step - 1)
    }

    const skipOnboarding = () => {
        // We will just mark as verified and go to dashboard
        submitData()
    }

    const submitData = async () => {
        setIsSubmitting(true)
        try {
            const allMethods = [...formData.methods]
            if (formData.customMethod.trim()) {
                allMethods.push(formData.customMethod.trim())
            }

            const res = await fetch("/api/user/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    methods: allMethods,
                    workDays: formData.workDays,
                    startTime: formData.startTime,
                    endTime: formData.endTime,
                    defaultSessionDuration: formData.defaultSessionDuration,
                    basePrice: formData.basePrice,
                    cancellationHours: formData.cancellationHours,
                    cancellationFee: formData.cancellationFee,
                    cancellationText: formData.cancellationText,
                })
            })
            if (res.ok) {
                router.refresh()
                router.push("/diary")
            }
        } catch (error) {
            console.error("Profile save error:", error)
        }
        setIsSubmitting(false)
    }

    // Step 1: Basics
    const renderStep1 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-white text-2xl font-bold mb-2">Общая информация</h2>
            <p className="text-white/70 text-sm mb-8">
                Эта информация поможет персонализировать ваш профиль. Вы всегда сможете изменить её в настройках.
            </p>

            <div className="space-y-6">
                <div>
                    <label className="block text-white text-sm mb-2">Имя и Фамилия</label>
                    <input
                        type="text"
                        placeholder="Анна Иванова"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-white text-sm mb-2">Email</label>
                    <input
                        type="email"
                        placeholder="anna@example.com"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-white text-sm mb-2">Метод (выберите один или несколько)</label>
                    <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2 custom-scrollbar mb-3">
                        {METHODS.map(method => (
                            <label key={method} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={formData.methods.includes(method)}
                                    onChange={() => handleMethodToggle(method)}
                                />
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.methods.includes(method) ? 'bg-[#c9a961] border-[#c9a961]' : 'border-white/30 group-hover:border-white/60'}`}>
                                    {formData.methods.includes(method) && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a4d3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-sm ${formData.methods.includes(method) ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                                    {method}
                                </span>
                            </label>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Другой метод..."
                        value={formData.customMethod}
                        onChange={(e) => setFormData({ ...formData, customMethod: e.target.value })}
                        className="w-full h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/40 outline-none focus:border-white/30 transition-all font-light"
                    />
                </div>

                <button
                    onClick={nextStep}
                    disabled={!formData.name || !formData.email || !hasSelectedMethods}
                    className="w-full h-[52px] bg-[#c9a961] hover:bg-[#d4b56d] disabled:opacity-50 disabled:hover:bg-[#c9a961] rounded-2xl text-[#1a4d3a] font-medium transition-colors mt-8"
                >
                    Продолжить
                </button>
            </div>
        </div>
    )

    // Step 2 & 3: Schedule
    const renderStep2 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-white text-2xl font-bold mb-2">Рабочие часы</h2>
            <p className="text-white/70 text-sm mb-8">
                Настройте базовое расписание работы. Это можно гибко менять позже для каждой недели отдельно.
            </p>

            <div className="space-y-6">
                <div>
                    <label className="block text-white text-sm mb-3">Рабочие дни</label>
                    <div className="grid grid-cols-7 gap-2">
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
                            <button
                                key={day}
                                onClick={() => toggleWorkDay(idx)}
                                className={`h-12 rounded-xl text-sm font-medium transition-colors ${formData.workDays[idx]
                                    ? "bg-[#c9a961] text-[#1a4d3a]"
                                    : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80"
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-white text-sm mb-2">Время начала</label>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white focus:border-white/40 outline-none"
                            style={{ colorScheme: 'dark' }} // fixes time picker icon color on webkit
                        />
                    </div>
                    <div>
                        <label className="block text-white text-sm mb-2">Время окончания</label>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white focus:border-white/40 outline-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-white text-sm mb-2">Длительность сеанса (мин)</label>
                        <input
                            type="number"
                            min="15"
                            step="5"
                            value={formData.defaultSessionDuration}
                            onChange={(e) => setFormData({ ...formData, defaultSessionDuration: parseInt(e.target.value) || 50 })}
                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white focus:border-white/40 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-white text-sm mb-2">Перерыв между (мин)</label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={formData.sessionBreak}
                            onChange={(e) => setFormData({ ...formData, sessionBreak: parseInt(e.target.value) || 0 })}
                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white focus:border-white/40 outline-none"
                        />
                    </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer group mb-4">
                        <input
                            type="checkbox"
                            className="hidden"
                            checked={formData.hasLunchBreak}
                            onChange={(e) => setFormData({ ...formData, hasLunchBreak: e.target.checked })}
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.hasLunchBreak ? 'bg-[#c9a961] border-[#c9a961]' : 'border-white/30 group-hover:border-white/60'}`}>
                            {formData.hasLunchBreak && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a4d3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </div>
                        <span className={`text-sm ${formData.hasLunchBreak ? 'text-white font-medium' : 'text-white/70 group-hover:text-white/90'}`}>
                            Есть обеденный перерыв
                        </span>
                    </label>

                    {formData.hasLunchBreak && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="block text-white/70 text-xs mb-2">Начало обеда</label>
                                <input
                                    type="time"
                                    value={formData.lunchStartTime}
                                    onChange={(e) => setFormData({ ...formData, lunchStartTime: e.target.value })}
                                    className="w-full h-10 px-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:border-white/40 outline-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                            <div>
                                <label className="block text-white/70 text-xs mb-2">Конец обеда</label>
                                <input
                                    type="time"
                                    value={formData.lunchEndTime}
                                    onChange={(e) => setFormData({ ...formData, lunchEndTime: e.target.value })}
                                    className="w-full h-10 px-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:border-white/40 outline-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        onClick={prevStep}
                        className="h-[52px] px-6 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-medium transition-colors"
                    >
                        Назад
                    </button>
                    <button
                        onClick={nextStep}
                        disabled={!formData.workDays.some(d => d)} // requires at least one day
                        className="flex-1 h-[52px] bg-[#c9a961] hover:bg-[#d4b56d] disabled:opacity-50 disabled:hover:bg-[#c9a961] rounded-2xl text-[#1a4d3a] font-medium transition-colors"
                    >
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
    )

    // Step 4: Pricing
    const renderStep4 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-white text-2xl font-bold mb-2">Стоимость и условия</h2>
            <p className="text-white/70 text-sm mb-8">
                Укажите базовую стоимость ваших услуг. Это увидят клиенты при онлайн записи.
            </p>

            <div className="space-y-6">
                <div>
                    <label className="block text-white text-sm mb-2">Стоимость (₽)</label>
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            step="100"
                            value={formData.basePrice || ''}
                            onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })}
                            placeholder="Например, 5000"
                            className="w-full h-12 px-4 pr-10 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40 focus:bg-white/15 transition-all text-xl font-medium"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 font-medium">₽</span>
                    </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9a961" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h3 className="text-white font-medium">Правила отмены</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-white/70 text-xs mb-2">Минимум часов до отмены</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.cancellationHours}
                                onChange={(e) => setFormData({ ...formData, cancellationHours: parseInt(e.target.value) || 0 })}
                                className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:border-white/40"
                            />
                        </div>
                        <div>
                            <label className="block text-white/70 text-xs mb-2">Процент оплаты (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.cancellationFee}
                                onChange={(e) => setFormData({ ...formData, cancellationFee: parseInt(e.target.value) || 0 })}
                                className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-xl text-white outline-none focus:border-white/40"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-white/70 text-xs mb-2">Текст правил для клиента</label>
                        <textarea
                            value={formData.cancellationText}
                            onChange={(e) => setFormData({ ...formData, cancellationText: e.target.value })}
                            placeholder="Отмена сессии возможна не позднее чем за 24 часа..."
                            className="w-full h-24 p-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40 outline-none focus:border-white/40 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={prevStep} className="h-[52px] px-6 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-medium transition-colors">Назад</button>
                    <button onClick={nextStep} className="flex-1 h-[52px] bg-[#c9a961] hover:bg-[#d4b56d] disabled:opacity-50 rounded-2xl text-[#1a4d3a] font-medium transition-colors">
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
    )

    // Step 5: Calendar Integration
    const renderStep5 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-white text-2xl font-bold mb-2">Синхронизация календаря</h2>
            <p className="text-white/70 text-sm mb-8">
                Подключите ваш текущий календарь, чтобы мы могли отображать ваши личные события и не допускали накладок в расписании.
            </p>

            <div className="space-y-4">
                <a href="/api/calendar/google/connect" target="_blank" className="w-full flex items-center justify-between p-4 bg-white rounded-2xl hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-4">
                        <Image src="/icons/google-calendar.svg" alt="Google Calendar" width={32} height={32} className="w-8 h-8" />
                        <span className="text-[#1a1a1a] font-medium">Google Calendar</span>
                    </div>
                    <span className="text-[#1a4d3a] text-sm font-medium px-4 py-2 bg-[#1a4d3a]/10 rounded-xl">Подключить</span>
                </a>

                <a href="/diary/integrations" target="_blank" className="w-full flex items-center justify-between p-4 bg-white rounded-2xl hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-4">
                        <Image src="/icons/yandex-calendar.svg" alt="Yandex" width={32} height={32} className="w-8 h-8 rounded" />
                        <span className="text-[#1a1a1a] font-medium">Яндекс Календарь</span>
                    </div>
                    <span className="text-[#1a4d3a] text-sm font-medium px-4 py-2 bg-[#1a4d3a]/10 rounded-xl">Подключить</span>
                </a>

                <div className="flex gap-4 pt-6">
                    <button onClick={prevStep} className="h-[52px] px-6 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-medium transition-colors">Назад</button>
                    <button onClick={nextStep} className="flex-1 h-[52px] bg-[#c9a961] hover:bg-[#d4b56d] rounded-2xl text-[#1a4d3a] font-medium transition-colors">
                        Далее (или пропустить)
                    </button>
                </div>
            </div>
        </div>
    )

    // Step 6: Completion
    const renderStep6 = () => (
        <div className="animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-[#c9a961] rounded-full mx-auto flex items-center justify-center mb-6">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a4d3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            <h2 className="text-white text-3xl font-bold mb-4">Всё готово!</h2>
            <p className="text-white/80 text-base mb-10 max-w-sm mx-auto">
                Ваш профиль психолога успешно настроен. Вы можете перейти в дневник, чтобы добавить первых клиентов и начать работу.
            </p>

            <button
                onClick={submitData}
                disabled={isSubmitting}
                className="w-full h-[56px] text-lg bg-[#c9a961] hover:bg-[#d4b56d] disabled:opacity-50 rounded-2xl text-[#1a4d3a] font-semibold transition-colors shadow-lg shadow-black/20"
            >
                {isSubmitting ? "Сохраняем..." : "Перейти в дневник"}
            </button>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1000px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">

                {/* Left Side - Interactive Form */}
                <div className="w-full md:w-[55%] bg-[#1a4d3a] p-8 lg:p-12 relative flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-12">
                        {/* Logo КОМПАС */}
                        <div className="flex items-center gap-3">
                            <Image src="/icon.png" alt="КОМПАС" width={32} height={32} className="w-8 h-8 rounded" />
                            <span className="text-xl font-medium tracking-[0.2em] text-white">
                                КОМПАС
                            </span>
                        </div>

                        {/* Skip Button (except Step 1 & 6) */}
                        {step > 1 && step < 6 && (
                            <button
                                onClick={skipOnboarding}
                                className="text-white/50 hover:text-white transition-colors text-sm font-medium"
                            >
                                Пропустить настройку
                            </button>
                        )}
                    </div>

                    {/* Progress Indicator (Steps 1-5) */}
                    {step < 6 && (
                        <div className="flex gap-2 mb-8">
                            {[1, 2, 4, 5].map((s, idx) => {
                                // Maps actual step number to UI indicators (since 2 and 3 are combined visually)
                                const isActive = step >= s
                                return (
                                    <div key={idx} className={`h-1 flex-1 rounded-full bg-white transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-20'}`} />
                                )
                            })}
                        </div>
                    )}

                    {/* Form Area */}
                    <div className="flex-1 flex flex-col justify-center max-w-[400px] w-full mx-auto relative">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep2()} {/* Safety mapping if state slips */}
                        {step === 4 && renderStep4()}
                        {step === 5 && renderStep5()}
                        {step === 6 && renderStep6()}
                    </div>
                </div>

                {/* Right Side - Image/Illustration (matches auth style) */}
                <div className="hidden md:block w-[45%] relative bg-[#f0ede5]">
                    <Image
                        src="/images/auth-side.jpg"
                        alt="Onboarding Background"
                        fill
                        className="object-cover opacity-90"
                        priority
                    />
                    {/* Dark gradient overlay to make text maybe? Or just pure image */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a4d3a]/60 to-transparent"></div>
                    <div className="absolute bottom-12 left-10 right-10">
                        <h3 className="text-2xl font-bold text-white mb-2 leading-tight shadow-md drop-shadow-lg">
                            Организуйте свою практику экологично
                        </h3>
                        <p className="text-white/80 font-medium drop-shadow-md">
                            Всё необходимое расписание, клиенты и статистика в одном месте.
                        </p>
                    </div>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            `}} />
        </div>
    )
}
