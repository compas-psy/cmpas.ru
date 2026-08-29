"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ShieldCheck } from "lucide-react"

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
            await signIn("yandex", { callbackUrl: "/diary" })
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
            const checkResult = await checkEmail(email)

            if (checkResult && !checkResult.canUseEmail) {
                setEmailWarning(checkResult.message || "Этот email связан с другим способом входа")
                setSuggestedProvider(checkResult.provider || null)
                setIsSubmitting(false)
                return
            }

            await signIn("nodemailer", { email, callbackUrl: "/diary" })
        } catch (error) {
            console.error("Email sign-in error:", error)
        }

        setIsSubmitting(false)
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

                {/* Левая часть: Форма авторизации */}
                <div className="flex flex-col items-center">
                    {/* Логотип */}
                    <Link
                        href="/"
                        className="flex items-center gap-3 mb-10 hover:opacity-90 transition-opacity"
                    >
                        <Image
                            src="/logo-tree.png"
                            alt="Compas Logo"
                            width={36}
                            height={36}
                            className="object-contain"
                        />
                        <span className="text-[22px] font-bold text-forest-800 tracking-wide uppercase">
                            ПРАКТИКА
                        </span>
                    </Link>

                    {/* Заголовок */}
                    <div className="text-center mb-8">
                        <h1 className="text-[28px] md:text-[32px] font-bold text-foreground leading-[1.15] mb-2.5">
                            Вход для психологов
                        </h1>
                        <p className="text-[15px] text-muted-foreground font-medium">
                            Войдите или зарегистрируйтесь, чтобы получить доступ к своему расписанию
                        </p>
                    </div>

                    {/* Карточка авторизации */}
                    <div className="w-full max-w-[420px] bg-forest-800 rounded-3xl shadow-floating p-8 lg:p-10">

                        {/* Кнопка Яндекс */}
                        <button
                            onClick={handleYandexAuth}
                            className="w-full bg-white hover:bg-sage-50 rounded-2xl px-6 py-[18px] flex items-center justify-center gap-3 transition-all mb-6 shadow-card active:scale-[0.97]"
                        >
                            <Image
                                src="/yandex-logo.png"
                                alt="Яндекс"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <span className="text-foreground font-semibold">
                                Продолжить с Яндекс
                            </span>
                        </button>

                        {/* Разделитель ИЛИ */}
                        <div className="relative h-6 mb-6">
                            <div className="absolute left-0 top-1/2 w-full h-px bg-white/20"></div>
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-forest-800 px-4">
                                <span className="text-white/60 text-small-meta font-semibold uppercase tracking-wider">или</span>
                            </div>
                        </div>

                        {/* Предупреждение об OAuth аккаунте */}
                        {emailWarning && (
                            <div className="mb-4 bg-accent rounded-2xl p-4 text-center">
                                <p className="text-forest-800 text-[14px] font-semibold mb-3">
                                    {emailWarning}
                                </p>
                                {suggestedProvider === "yandex" && (
                                    <button
                                        onClick={handleYandexAuth}
                                        className="w-full bg-white hover:bg-sage-50 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Image
                                            src="/yandex-logo.png"
                                            alt="Яндекс"
                                            width={20}
                                            height={20}
                                            className="object-contain"
                                        />
                                        <span className="text-foreground text-sm font-semibold">
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
                                        if (emailWarning) {
                                            setEmailWarning(null)
                                            setSuggestedProvider(null)
                                        }
                                    }}
                                    className="w-full bg-white rounded-2xl px-5 py-4 text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-accent/70 transition-all text-[15px] font-medium"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-accent hover:bg-accent/90 text-forest-800 rounded-2xl px-6 py-4 font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] text-[15px]"
                            >
                                {isSubmitting ? (
                                    "Проверяем..."
                                ) : (
                                    <>
                                        Продолжить по email
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Пользовательское соглашение */}
                        <div className="mt-6 text-center text-[12px] text-white/50 leading-relaxed font-medium">
                            <p>
                                Продолжая, вы соглашаетесь с{" "}
                                <a href="/legal/terms" className="text-white/70 underline underline-offset-2 hover:text-white/90 transition-colors">
                                    Пользовательским соглашением
                                </a>
                            </p>
                            <p className="mt-1">
                                и{" "}
                                <a href="/legal/privacy" className="text-white/70 underline underline-offset-2 hover:text-white/90 transition-colors">
                                    Политикой конфиденциальности
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Ссылка на главную */}
                    <Link
                        href="/"
                        className="mt-8 text-[14px] text-muted-foreground hover:text-forest-700 transition-colors font-medium"
                    >
                        ← Вернуться на главную
                    </Link>
                </div>

                {/* Правая часть: Декоративное изображение */}
                <div className="hidden lg:flex items-center justify-center w-full max-w-[600px]">
                    <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-floating">
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
