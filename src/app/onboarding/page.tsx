"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function OnboardingPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        email: "",
        timezone: "",
        error: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (step === 1) {
            setStep(2)
        } else if (step === 2) {
            // Save user data
            try {
                const res = await fetch("/api/user/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData)
                })
                if (res.ok) {
                    router.push("/psidairy")
                } else {
                    setFormData({ ...formData, error: "Ошибка сохранения данных" })
                }
            } catch (error) {
                setFormData({ ...formData, error: "Ошибка сети" })
            }
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
            <div className="flex gap-8 max-w-5xl w-full">
                {/* Left Card - Form */}
                <div className="bg-[#3D5A4D] text-white rounded-3xl p-10 w-[440px] flex flex-col justify-center shadow-2xl">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8">
                        <Image src="/forest.jpg" alt="КОМПАС" width={24} height={24} className="rounded" />
                        <span className="text-lg font-medium tracking-wide">КОМПАС</span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {step === 1 && (
                            <>
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">Расскажите о себе</h2>
                                    <p className="text-white/70 text-sm mb-6">
                                        Эта информация поможет персонализировать ваш опыт
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Имя и Фамилия</label>
                                    <input
                                        type="text"
                                        placeholder="Анна Иванова"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/30 outline-none text-white placeholder:text-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Email</label>
                                    <input
                                        type="email"
                                        placeholder="anna@example.com"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/30 outline-none text-white placeholder:text-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Профессия/специализация</label>
                                    <input
                                        type="text"
                                        placeholder="Укажите вашу специализацию"
                                        value={formData.surname}
                                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/30 outline-none text-white placeholder:text-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">О себе</label>
                                    <textarea
                                        placeholder="Расскажите о своих целях и ожиданиях"
                                        rows={3}
                                        className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-white/30 outline-none text-white placeholder:text-white/50 resize-none"
                                    />
                                </div>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div>
                                    <h2 className="text-xl font-semibold mb-2">Рабочее время</h2>
                                    <p className="text-white/70 text-sm mb-6">
                                        Укажите, когда вы обычно работаете
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-3">Часовой пояс (GMT+3)</label>
                                    <input
                                        type="text"
                                        value="GMT+3"
                                        disabled
                                        className="w-full px-4 py-3.5 bg-white/5 border border-white/20 rounded-xl text-white/70"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-3">Рабочие дни</label>
                                    <div className="grid grid-cols-7 gap-2">
                                        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, idx) => (
                                            <button
                                                key={day}
                                                type="button"
                                                className={`py-3 rounded-lg text-sm font-medium transition-all ${idx < 5
                                                        ? "bg-white/20 text-white"
                                                        : "bg-white/5 text-white/40 hover:bg-white/10"
                                                    }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">С</label>
                                        <input
                                            type="time"
                                            defaultValue="09:00"
                                            className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">До</label>
                                        <input
                                            type="time"
                                            defaultValue="18:00"
                                            className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3.5 bg-white hover:bg-white/90 text-[#3D5A4D] rounded-xl font-medium transition-all"
                                    >
                                        Завершить
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 1 && (
                            <button
                                type="submit"
                                className="w-full px-6 py-3.5 bg-white hover:bg-white/90 text-[#3D5A4D] rounded-xl font-medium transition-all"
                            >
                                Продолжить
                            </button>
                        )}

                        {formData.error && (
                            <p className="text-red-300 text-sm text-center">{formData.error}</p>
                        )}
                    </form>
                </div>

                {/* Right Image */}
                <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl min-h-[600px]">
                    <Image
                        src="/forest.jpg"
                        alt="Forest"
                        fill
                        className="object-cover"
                        priority
                    />
                </div>
            </div>
        </div>
    )
}
