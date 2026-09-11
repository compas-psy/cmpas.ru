"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { safeReturnPath } from "@/lib/auth/return-path"
import type { LegalLinks } from "@/lib/auth/simpasid-legal"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ShieldCheck } from "lucide-react"

export default function AuthForm({ simpasIdEnabled, legalLinks }: { simpasIdEnabled: boolean; legalLinks: LegalLinks }) {
    // Куда вернуть после входа — читаем в момент нажатия, а не хуком.
    //
    // useSearchParams() здесь потребовал бы обёртки в Suspense и ронял
    // сборку на пререндере /auth. А значение нужно ровно один раз, когда
    // человек нажимает «Войти», — тогда его и берём.
    //
    // Разбор строгий (см. safeReturnPath): без него параметр «куда
    // вернуться» стал бы открытой переадресацией.
    const returnPath = () => safeReturnPath(
        typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next")
    )
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // ОБА ПРОВАЙДЕРА ИДУТ ЧЕРЕЗ ЕДИНЫЙ ВХОД.
    //
    // Кнопка Яндекса вела в НАШЕ приложение Яндекс ID, то есть личность
    // ПРАКТИКА получала напрямую от провайдера, минуя Экосистему. Пока
    // подсказки провайдера у СИМПАС не было, иначе и не получалось. Теперь
    // есть, и решением учредителя от 11.09.2026 обе двери сведены в одну.
    //
    // НИЧЕГО НЕ УДАЛЯЕТСЯ. Человек, входивший прежней кнопкой, попадёт в ту
    // же учётную запись: связывание идёт по подтверждённой почте
    // (allowDangerousEmailAccountLinking у провайдера simpasid). Прежняя
    // строка Account с provider='yandex' остаётся лежать нетронутой, рядом
    // появляется вторая — 'simpasid'.
    const handleYandexAuth = async () => {
        try {
            await signIn("simpasid", { callbackUrl: returnPath() }, { provider: "yandex" })
        } catch (error) {
            console.error("Yandex sign-in error:", error)
        }
    }

    // Кружок VK ведёт в СИМПАС, а не к VK напрямую, и это не обходной путь.
    //
    // Своего приложения VK у ПРАКТИКИ нет и не должно быть: §2
    // четырнадцатого ТЗ отдаёт личность Экосистеме целиком. Подсказка
    // provider=vkid — необязательный параметр, который СИМПАС завёл по
    // нашей просьбе: на их экране VK встаёт первым и помечен.
    //
    // ЧЕГО ОНА НЕ ДЕЛАЕТ: не пропускает экран СИМПАС насквозь. Человек
    // увидит его и нажмёт второй раз. Это не недоделка, а требование
    // того же параграфа: Пользовательское соглашение принимается на их
    // экране и больше нигде, а уведи мы человека прямо к VK — принимать
    // его стало бы негде.
    const handleVkAuth = async () => {
        try {
            await signIn("simpasid", { callbackUrl: returnPath() }, { provider: "vkid" })
        } catch (error) {
            console.error("VK sign-in error:", error)
        }
    }

    // ВХОД ПО ПОЧТЕ ТОЖЕ ИДЁТ В ЕДИНЫЙ ВХОД.
    //
    // Раньше форма звала наш собственный signIn("nodemailer") — и человек,
    // заведённый ею, Пользовательское соглашение не принимал НИГДЕ: акцепт
    // происходит на экране СИМПАС, кнопкой входа. Записать его у себя мы
    // не можем (§2.7, §9.7 четырнадцатого ТЗ), а у СИМПАС такого человека
    // не существует — у него нет sub, и писать согласие некому и не о ком.
    // То есть выбор был не «принял у нас или у них», а «принял или не
    // принял вовсе».
    //
    // Набранный адрес уходит подсказкой login_hint: их экран подставит его
    // в своё поле, и человек не набирает почту дважды. Пока подсказка у них
    // не выложена, параметр просто игнорируется — ломаться тут нечему.
    // Подтверждением адреса он не является: код всё равно уходит в ящик.
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            if (simpasIdEnabled) {
                await signIn("simpasid", { callbackUrl: returnPath() }, { login_hint: email })
            } else {
                // Единый вход не настроен — на экране не осталось бы ни одного
                // способа войти. Прежняя дверь держится ровно для этого случая
                // и ни для какого другого.
                await signIn("nodemailer", { email, callbackUrl: returnPath() })
            }
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
                    {/* СЛОВО ЦЕНТРИРУЕТСЯ, А НЕ БЛОК СО ЗНАКОМ.
                        Раньше по центру стояла пара «знак + слово», и само
                        слово из-за этого сидело на 24 px правее центра
                        карточки — глаз это ловит, хотя вёрстка формально
                        «по центру». Знак вынесен из потока и висит слева от
                        слова: центр слова совпадает с центром карточки. */}
                    <Link
                        href="/"
                        className="relative flex items-center justify-center mb-10 hover:opacity-90 transition-opacity"
                    >
                        <Image
                            src="/logo-tree.png"
                            alt=""
                            width={36}
                            height={36}
                            className="object-contain absolute right-full mr-3"
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

                        {/* ВХОД ЗНАКОМ, А НЕ ПОЛОСОЙ.
                            Две продолговатые кнопки занимали половину карточки и
                            спорили с главным действием — входом по почте. Знак
                            узнаётся быстрее подписи, а ряд кружков читается как
                            «вот способы», а не как «вот два предложения».

                            В ряду только то, что ДЕЙСТВИТЕЛЬНО открывается.
                            Кружок, за которым ничего нет, — обещание, которое
                            некому исполнить, и на экране входа оно стоит дороже
                            всего: человек нажимает и остаётся снаружи. */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                            {/* ОБА КРУЖКА ВЕДУТ В ЕДИНЫЙ ВХОД и показываются
                                только при настроенном СИМПАС: без него за ними
                                ничего нет, а кружок, за которым ничего нет, —
                                обещание, которое некому исполнить.

                                Отдельного кружка СИМПАС здесь больше нет. Он
                                вёл ровно туда же, только без подсказки
                                провайдера, — то есть предлагал человеку
                                выбрать «войти через сервис входа» рядом с
                                «войти через Яндекс», хотя это одно и то же
                                место. Вход по почте в СИМПАС никуда не делся:
                                он на их же экране, рядом с обеими кнопками. */}
                            {simpasIdEnabled && (
                                <button
                                    onClick={handleYandexAuth}
                                    aria-label="Войти через Яндекс"
                                    title="Яндекс"
                                    className="w-14 h-14 rounded-full bg-white hover:bg-sage-50 flex items-center justify-center transition-all shadow-card active:scale-[0.94]"
                                >
                                    <Image src="/yandex-logo.png" alt="" width={28} height={28} className="object-contain" />
                                </button>
                            )}

                            {/* Знаки — копии канонических файлов единого входа
                                (compas-psy/auth). Чужой знак не
                                перекрашивается под нашу тему. */}
                            {simpasIdEnabled && (
                                <button
                                    onClick={handleVkAuth}
                                    aria-label="Войти через VK"
                                    title="VK"
                                    className="w-14 h-14 rounded-full bg-white hover:bg-sage-50 flex items-center justify-center transition-all shadow-card active:scale-[0.94]"
                                >
                                    <Image src="/vk-logo.svg" alt="" width={28} height={28} className="object-contain" />
                                </button>
                            )}
                        </div>

                        {/* Разделитель ИЛИ */}
                        <div className="relative h-6 mb-6">
                            <div className="absolute left-0 top-1/2 w-full h-px bg-white/20"></div>
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-forest-800 px-4">
                                <span className="text-white/60 text-small-meta font-semibold uppercase tracking-wider">или</span>
                            </div>
                        </div>

                        {/* Форма email */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Введите email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
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

                        {/* ЗДЕСЬ НЕ ПРИНИМАЮТ ДОКУМЕНТЫ — ЗДЕСЬ НА НИХ ССЫЛАЮТСЯ.
                            До 11.09.2026 стояло «Продолжая, вы соглашаетесь с
                            Пользовательским соглашением и Политикой
                            конфиденциальности». Две ошибки в одной фразе:

                            * Пользовательское соглашение принимается в СИМПАС,
                              при создании учётной записи. Акцепт здесь — вторая
                              запись о том же факте, с другим временем и другим
                              источником, и в споре придётся объяснять, какая из
                              двух настоящая;
                            * Политику НЕ ПРИНИМАЮТ вовсе. Это информационный
                              документ оператора, и глагол принятия рядом с ним
                              сам по себе дефект правовой конструкции
                              (14_LEGAL_PRODUCTS_UNIFIED.md §2.7, §9.7).

                            Ссылки остаются: прочитать документ человек вправе в
                            любой момент. Уйдут они на auth.cmpas.ru в тот день,
                            когда центральные тексты там опубликуют. */}
                        <div className="mt-6 text-center text-[12px] text-white/50 leading-relaxed font-medium">
                            <p>
                                <a href={legalLinks.terms} className="text-white/70 underline underline-offset-2 hover:text-white/90 transition-colors">
                                    Пользовательское соглашение
                                </a>
                                {" · "}
                                <a href={legalLinks.privacy} className="text-white/70 underline underline-offset-2 hover:text-white/90 transition-colors">
                                    Политика конфиденциальности
                                </a>
                                {/* Особые условия ПРАКТИКИ — дополнение к
                                    центральному Соглашению, и без него ссылок
                                    было две там, где документов три: человек
                                    не видел того, что относится именно к
                                    продукту, которым он пользуется. Ссылка
                                    появляется, только когда документ есть в
                                    реестре: выдуманного адреса тут быть не
                                    может. */}
                                {legalLinks.practiceTerms && (
                                    <>
                                        {" · "}
                                        <a href={legalLinks.practiceTerms} className="text-white/70 underline underline-offset-2 hover:text-white/90 transition-colors">
                                            Особые условия ПРАКТИКИ
                                        </a>
                                    </>
                                )}
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
