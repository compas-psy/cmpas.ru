import Link from "next/link"
import Image from "next/image"

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

                {/* Левая часть: Сообщение 404 */}
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

                    {/* Карточка 404 */}
                    <div className="w-full max-w-[420px] bg-[#1a4d3a] rounded-3xl shadow-xl p-8 lg:p-12 text-center">
                        {/* Большой 404 */}
                        <div className="text-8xl font-bold text-white/20 mb-4">
                            404
                        </div>

                        <h1 className="text-2xl font-semibold text-white mb-4">
                            Страница не найдена
                        </h1>

                        <p className="text-white/80 text-base mb-8 leading-relaxed">
                            К сожалению, запрашиваемая страница не существует или была перемещена.
                        </p>

                        {/* Кнопка на главную */}
                        <Link
                            href="/"
                            className="block w-full bg-[#c9a961] hover:bg-[#d4b56d] text-[#1a4d3a] rounded-2xl px-6 py-4 font-medium transition-colors text-center"
                        >
                            На главную
                        </Link>
                    </div>

                    {/* Дополнительные ссылки */}
                    <div className="mt-8 flex gap-6 text-sm text-[#1a4d3a]/60">
                        <Link href="/" className="hover:text-[#1a4d3a] transition-colors">
                            Главная
                        </Link>
                        <Link href="/blog" className="hover:text-[#1a4d3a] transition-colors">
                            Блог
                        </Link>
                        <Link href="/auth" className="hover:text-[#1a4d3a] transition-colors">
                            Войти
                        </Link>
                    </div>
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
