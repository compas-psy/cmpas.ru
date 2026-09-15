import Link from "next/link"
import Image from "next/image"

/**
 * «Эта почта уже занята» — и здесь человека уводили мимо единого входа.
 *
 * Страница звала `signIn("yandex")` напрямую: во-первых, мимо СИМПАСа, через
 * который теперь идут все двери; во-вторых, наугад — аккаунт мог быть заведён
 * и через ВК, и через сам СИМПАС, и тогда кнопка «Войти через Яндекс» просто
 * не та дверь. Человек, которому сказали «вы уже зарегистрированы», упирался
 * в предложение войти способом, которым он, возможно, никогда не входил.
 *
 * Теперь отсюда один путь — обратно на `/auth`, где дверь выбирает сервер,
 * а не эта страница. Заодно ушли остатки прежнего имени продукта.
 */
export default function EmailExistsPage() {
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
                            alt="ПРАКТИКА"
                            width={40}
                            height={40}
                            className="object-contain"
                        />
                        <span className="text-2xl font-semibold text-[#1a4d3a] tracking-wide">
                            ПРАКТИКА
                        </span>
                    </Link>

                    {/* Карточка */}
                    <div className="w-full max-w-[420px] bg-[#1a4d3a] rounded-2xl shadow-xl p-8 lg:p-12 text-center">
                        {/* Иконка */}
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">✓</span>
                        </div>

                        <h1 className="text-2xl font-semibold text-white mb-4">
                            Вы уже зарегистрированы
                        </h1>

                        <p className="text-white/80 text-base mb-8 leading-relaxed">
                            Эта почта уже связана с аккаунтом.<br />
                            Войдите тем же способом, каким заводили его.
                        </p>

                        <Link
                            href="/auth"
                            className="w-full bg-white hover:bg-gray-50 rounded-2xl px-6 py-4 flex items-center justify-center gap-3 transition-colors mb-4"
                        >
                            <span className="text-[#1a1a1a] font-medium">
                                Перейти ко входу
                            </span>
                        </Link>

                        <div className="bg-[#c9a961] rounded-2xl px-6 py-4">
                            <p className="text-sm text-[#1a4d3a] font-medium">
                                На экране входа будут все ваши двери:<br />
                                Яндекс, ВК и почта. Пароль помнить не нужно.
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
                    <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl">
                        <Image
                            src="/images/auth-side.jpg"
                            alt="ПРАКТИКА"
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
