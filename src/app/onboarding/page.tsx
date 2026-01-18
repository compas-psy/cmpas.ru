"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        profession: "",
        about: "",
        timezone: "GMT+3",
        workDays: [true, true, true, true, true, false, false],
        startTime: "09:00",
        endTime: "18:00"
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (step === 1) {
            setStep(2)
        } else {
            try {
                const res = await fetch("/api/user/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData)
                })
                if (res.ok) {
                    router.push("/")
                }
            } catch (error) {
                console.error("Profile save error:", error)
            }
        }
    }

    const toggleWorkDay = (index: number) => {
        const newDays = [...formData.workDays]
        newDays[index] = !newDays[index]
        setFormData({ ...formData, workDays: newDays })
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
            <div className="w-full max-w-[1152px] flex gap-6">
                {/* Logo */}
                <div className="absolute top-8 left-8 flex items-center gap-2">
                    <div className="w-6 h-6 bg-[#3D5A4D] rounded"></div>
                    <span className="text-[#1F2937] text-base font-normal" style={{ fontFamily: 'Segoe UI' }}>
                        КОМПАС
                    </span>
                </div>

                {/* Left Side - Onboarding Card */}
                <div className="w-[448px]">
                    <div className="bg-[#3D5A4D] rounded-3xl p-10 shadow-[0px_8px_16px_rgba(0,0,0,0.1)]" style={{ minHeight: '560px' }}>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {step === 1 && (
                                <>
                                    <div>
                                        <h2 className="text-white text-xl font-semibold mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Расскажите о себе
                                        </h2>
                                        <p className="text-white/70 text-sm" style={{ fontFamily: 'Segoe UI' }}>
                                            Эта информация поможет персонализировать ваш опыт
                                        </p>
                                    </div>

                                    {/* Name and Surname */}
                                    <div>
                                        <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Имя и Фамилия
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Анна Иванова"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40"
                                            style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                        />
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="anna@example.com"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40"
                                            style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                        />
                                    </div>

                                    {/* Profession */}
                                    <div>
                                        <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Профессия/специализация
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Укажите вашу специализацию"
                                            value={formData.profession}
                                            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                                            className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40"
                                            style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                        />
                                    </div>

                                    {/* About */}
                                    <div>
                                        <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            О себе
                                        </label>
                                        <textarea
                                            placeholder="Расскажите о своих целях и ожиданиях"
                                            rows={3}
                                            value={formData.about}
                                            onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-white/50 outline-none focus:border-white/40 resize-none"
                                            style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full h-12 bg-white/90 hover:bg-white rounded-2xl text-[#3D5A4D] text-sm font-medium transition-colors"
                                        style={{ fontFamily: 'Segoe UI' }}
                                    >
                                        Продолжить
                                    </button>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <div>
                                        <h2 className="text-white text-xl font-semibold mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Рабочие часы
                                        </h2>
                                        <p className="text-white/70 text-sm" style={{ fontFamily: 'Segoe UI' }}>
                                            Укажите, когда вы обычно работаете
                                        </p>
                                    </div>

                                    {/* Timezone */}
                                    <div>
                                        <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                            Часовой пояс (GMT+3)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.timezone}
                                            disabled
                                            className="w-full h-12 px-4 bg-white/5 border border-white/20 rounded-2xl text-white/70"
                                            style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                        />
                                    </div>

                                    {/* Work Days */}
                                    <div>
                                        <label className="block text-white text-sm mb-3" style={{ fontFamily: 'Segoe UI' }}>
                                            Рабочие дни
                                        </label>
                                        <div className="grid grid-cols-7 gap-2">
                                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => toggleWorkDay(idx)}
                                                    className={`h-9 rounded-lg text-xs font-medium transition-colors ${formData.workDays[idx]
                                                        ? "bg-white/20 text-white"
                                                        : "bg-white/5 text-white/40 hover:bg-white/10"
                                                        }`}
                                                    style={{ fontFamily: 'Segoe UI' }}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Time Range */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                                С
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.startTime}
                                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white"
                                                style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-white text-sm mb-2" style={{ fontFamily: 'Segoe UI' }}>
                                                До
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.endTime}
                                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-2xl text-white"
                                                style={{ fontFamily: 'Segoe UI', fontSize: '14px' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Navigation Buttons */}
                                    <div className="flex gap-4 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="flex-1 h-12 bg-white/10 hover:bg-white/20 rounded-2xl text-white text-sm font-medium transition-colors"
                                            style={{ fontFamily: 'Segoe UI' }}
                                        >
                                            Назад
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 h-12 bg-white/90 hover:bg-white rounded-2xl text-[#3D5A4D] text-sm font-medium transition-colors"
                                            style={{ fontFamily: 'Segoe UI' }}
                                        >
                                            Завершить
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right Side - Image */}
                <div className="flex-1 relative rounded-3xl overflow-hidden" style={{ height: '560px' }}>
                    <Image
                        src="/forest.jpg"
                        alt="Forest landscape"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    )
}
