"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"

/**
 * Дверь по умолчанию: человек, не вошедший в ПРАКТИКУ, уходит в единый вход.
 *
 * Почему уход делает браузер, а не сервер: адрес авторизации собирает сам
 * next-auth — с состоянием и защитой от подделки запроса. Собрать его руками
 * в редиректе с сервера значит повторить эту сборку во втором месте и
 * разойтись с ней при первом же обновлении библиотеки.
 *
 * Экран при этом не пустой: между заходом и переходом человек видит, куда
 * его ведут. Мгновенный уход в другой домен без единого слова читается как
 * «меня куда-то выкинуло».
 *
 * Оформление намеренно то же, что у формы входа: это не новый экран, а тот
 * же вход в другой момент времени.
 *
 * @param returnPath куда вернуть после входа. Разбор строгий и сделан НА
 *   СЕРВЕРЕ (страница), а не здесь: этот компонент рисуется и на сервере
 *   тоже, а там window не существует.
 * @param emailDoorHref адрес запасной двери, с сохранённым возвратом.
 */
export default function SimpasIdDoor({
    returnPath,
    emailDoorHref,
}: {
    returnPath: string
    emailDoorHref: string
}) {
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        signIn("simpasid", { callbackUrl: returnPath }).catch(() => setFailed(true))
    }, [returnPath])

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-sm flex flex-col items-center text-center">
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

                <h1 className="text-[24px] font-bold text-foreground mb-2.5">
                    {failed ? "Вход сейчас недоступен" : "Открываем вход…"}
                </h1>
                <p className="text-[15px] text-muted-foreground font-medium mb-10">
                    {failed
                        ? "Не удалось открыть страницу входа. Войдите по почте — ссылка ниже."
                        : "Сейчас откроется страница, где вы подтвердите, что это вы."}
                </p>

                {/* Запасная дверь. Мелко и внизу: она существует не для
                    выбора, а на случай, когда единый вход недоступен или
                    учётной записи в нём ещё нет. */}
                <Link
                    href={emailDoorHref}
                    className="text-[14px] text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                    Войти по почте
                </Link>
            </div>
        </div>
    )
}
