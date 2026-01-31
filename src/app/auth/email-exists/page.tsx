"use client"

import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"

export default function EmailExistsPage() {
    const handleYandexAuth = async () => {
        try {
            await signIn("yandex", { callbackUrl: "/" })
        } catch (error) {
            console.error("Yandex sign-in error:", error)
        }
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                {/* Левая часть: Сообщение */}
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

                    {/* Карточка */}
                    <div className="w-full max-w-[420px] bg-[#1a4d3a] rounded-3xl shadow-xl p-8 lg:p-12 text-center">
                        {/* Иконка */}
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">✓</span>
                        </div>

                        <h1 className="text-2xl font-semibold text-white mb-4">
                            Вы уже зарегистрированы
                        </h1>

                        <p className="text-white/80 text-base mb-8 leading-relaxed">
                            Этот email уже связан с вашим аккаунтом.<br />
                            Войдите через Яндекс для продолжения.
                        </p>

                        {/* Кнопка Яндекс */}
                        <button
                            onClick={handleYandexAuth}
                            className="w-full bg-white hover:bg-gray-50 rounded-2xl px-6 py-4 flex items-center justify-center gap-3 transition-colors mb-4"
                        >
                            <Image
                                src="/yandex-logo.png"
                                alt="Яндекс"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            <span className="text-[#1a1a1a] font-medium">
                                Войти через Яндекс
                            </span>
                        </button>

                        {/* Подсказка */}
                        <div className="bg-[#c9a961] rounded-2xl px-6 py-4">
                            <p className="text-sm text-[#1a4d3a] font-medium">
                                💡 Быстрый и безопасный вход<br />
                                без необходимости помнить пароль
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
