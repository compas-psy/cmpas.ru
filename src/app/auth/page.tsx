"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

interface EmailCheckResponse {
    exists: boolean
    canUseEmail: boolean
    provider?: string
    providerName?: string
    message?: string
}

export default function AuthPage() {
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [emailWarning, setEmailWarning] = useState<string | null>(null)
    const [suggestedProvider, setSuggestedProvider] = useState<string | null>(null)

    const handleYandexAuth = async () => {
        try {
            await signIn("yandex", { callbackUrl: "/" })
        } catch (error) {
            console.error("Yandex sign-in error:", error)
        }
    }

    const checkEmail = async (emailToCheck: string): Promise<EmailCheckResponse | null> => {
        try {
            const response = await fetch("/api/auth/check-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailToCheck })
            })
            if (!response.ok) return null
            return await response.json()
        } catch {
            return null
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setEmailWarning(null)
        setSuggestedProvider(null)

        try {
            // Check if email has OAuth account
            const checkResult = await checkEmail(email)

            if (checkResult && !checkResult.canUseEmail) {
                // User has OAuth account - show warning
                setEmailWarning(checkResult.message || "Этот email связан с другим способом входа")
                setSuggestedProvider(checkResult.provider || null)
                setIsSubmitting(false)
                return
            }

            // Proceed with email sign in
            await signIn("nodemailer", { email, callbackUrl: "/" })
        } catch (error) {
            console.error("Email sign-in error:", error)
        }

        setIsSubmitting(false)
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                {/* Левая часть: Форма авторизации */}
                <div className="flex flex-col items-center">
                    {/* Логотип с деревом */}
                    <Link
                        href="/"
                        className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity"
                    >
                        <Image
                            src="/logo-tree.png"
                            alt="Compas Logo"
                            width={40}
                            height={40}
                            className="object-contain"
                        />
                        <span className="text-2xl font-semibold text-[#1a4d3a] tracking-wide">
                            ЕЖЕДНЕВНИК ПСИХОЛОГА
                        </span>
                    </Link>

                    {/* Карточка авторизации */}
                    <div className="w-full max-w-[420px] bg-[#1a4d3a] rounded-3xl shadow-xl p-8 lg:p-12">

                        {/* Кнопка Яндекс */}
                        <button
                            onClick={handleYandexAuth}
                            className="w-full bg-white hover:bg-gray-50 rounded-2xl px-6 py-4 flex items-center justify-center gap-3 transition-colors mb-6"
                        >
                            <Image
                                src="/yandex-logo.png"
                                alt="Яндекс"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <span className="text-[#1a1a1a] font-medium">
                                Продолжить с Яндекс
                            </span>
                        </button>

                        {/* Разделитель ИЛИ */}
                        <div className="relative h-6 mb-6">
                            <div className="absolute left-0 top-1/2 w-full h-px bg-white/30"></div>
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a4d3a] px-3">
                                <span className="text-white text-sm">ИЛИ</span>
                            </div>
                        </div>

                        {/* Предупреждение об OAuth аккаунте */}
                        {emailWarning && (
                            <div className="mb-4 bg-[#c9a961] rounded-2xl p-4 text-center">
                                <p className="text-[#1a4d3a] text-sm font-medium mb-3">
                                    {emailWarning}
                                </p>
                                {suggestedProvider === "yandex" && (
                                    <button
                                        onClick={handleYandexAuth}
                                        className="w-full bg-white hover:bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Image
                                            src="/yandex-logo.png"
                                            alt="Яндекс"
                                            width={20}
                                            height={20}
                                            className="object-contain"
                                        />
                                        <span className="text-[#1a1a1a] text-sm font-medium">
                                            Войти через Яндекс
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Форма email */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Введите email"
                                    required
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        // Clear warning when user changes email
                                        if (emailWarning) {
                                            setEmailWarning(null)
                                            setSuggestedProvider(null)
                                        }
                                    }}
                                    className="w-full bg-white rounded-2xl px-5 py-4 text-[#1a1a1a] placeholder:text-[#1a1a1a]/50 outline-none focus:ring-2 focus:ring-[#c9a961] transition-all"
                                />
                                {/* Иконка защиты */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1a1a1a]/40">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#c9a961] hover:bg-[#d4b56d] text-[#1a4d3a] rounded-2xl px-6 py-4 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    "Проверяем..."
                                ) : (
                                    <>
                                        Продолжить по email
                                        <svg
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Пользовательское соглашение */}
                        <div className="mt-6 text-center text-xs text-white/70 leading-relaxed">
                            <p>
                                Продолжая, вы соглашаетесь с{" "}
                                <a href="/legal/terms" className="text-white underline hover:text-white/90 transition-colors">
                                    Пользовательским соглашением
                                </a>
                            </p>
                            <p className="mt-1">
                                и{" "}
                                <a href="/legal/privacy" className="text-white underline hover:text-white/90 transition-colors">
                                    Политикой конфиденциальности
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Ссылка на главную */}
                    <Link
                        href="/"
                        className="mt-8 text-sm text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors"
                    >
                        ← Вернуться на главную
                    </Link>
                </div>

                {/* Правая часть: Декоративное изображение */}
                <div className="hidden lg:flex items-center justify-center w-full max-w-[600px]">
                    <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl">
                        <Image
                            src="/images/auth-side.jpg"
                            alt="Ежедневник психолога с кофе"
                            fill
                            className="object-cover"
                            sizes="600px"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
