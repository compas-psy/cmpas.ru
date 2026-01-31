"use client"

import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const errorMessages: Record<string, { title: string; description: string; icon: string }> = {
    Verification: {
        title: "Ссылка недействительна",
        description: "Ссылка для входа больше недействительна. Возможно, она уже была использована или истёк срок действия.",
        icon: "⏰"
    },
    OAuthAccountNotLinked: {
        title: "Email уже зарегистрирован",
        description: "Этот email уже связан с аккаунтом через другой способ входа. Попробуйте войти через Яндекс.",
        icon: "🔗"
    },
    Configuration: {
        title: "Ошибка сервера",
        description: "Произошла ошибка конфигурации. Пожалуйста, попробуйте позже или обратитесь в поддержку.",
        icon: "⚙️"
    },
    AccessDenied: {
        title: "Доступ запрещён",
        description: "У вас нет доступа к этому ресурсу. Если это ошибка, обратитесь в поддержку.",
        icon: "🚫"
    },
    Default: {
        title: "Ошибка авторизации",
        description: "Произошла непредвиденная ошибка. Пожалуйста, попробуйте ещё раз.",
        icon: "❌"
    }
}

function AuthErrorContent() {
    const searchParams = useSearchParams()
    const errorType = searchParams.get("error") || "Default"
    const error = errorMessages[errorType] || errorMessages.Default

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                {/* Левая часть: Сообщение об ошибке */}
                <div className="flex flex-col items-center">
                    {/* Логотип */}
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

                    {/* Карточка ошибки */}
                    <div className="w-full max-w-[420px] bg-[#1a4d3a] rounded-3xl shadow-xl p-8 lg:p-12 text-center">
                        {/* Иконка */}
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">{error.icon}</span>
                        </div>

                        <h1 className="text-2xl font-semibold text-white mb-4">
                            {error.title}
                        </h1>

                        <p className="text-white/80 text-base mb-8 leading-relaxed">
                            {error.description}
                        </p>

                        {/* Кнопки действий */}
                        <div className="space-y-3">
                            <Link
                                href="/auth"
                                className="block w-full bg-[#c9a961] hover:bg-[#d4b56d] text-[#1a4d3a] rounded-2xl px-6 py-4 font-medium transition-colors text-center"
                            >
                                Попробовать снова
                            </Link>

                            {errorType === "Verification" && (
                                <p className="text-white/50 text-sm">
                                    Запросите новую ссылку на странице входа
                                </p>
                            )}
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
                            alt="Ежедневник психолога"
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

export default function AuthErrorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
                <div className="animate-pulse text-[#1a4d3a]">Загрузка...</div>
            </div>
        }>
            <AuthErrorContent />
        </Suspense>
    )
}
