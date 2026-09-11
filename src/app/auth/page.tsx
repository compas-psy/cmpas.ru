// Страница входа. Серверная обёртка над формой.
//
// Обёртка нужна ровно для одного: узнать, настроен ли единый вход СИМПАС.
// Форма — клиентская (нажатия, состояние поля почты), а переменные с
// ключом провайдера живут только на сервере и в браузер не отдаются.
// Пока ключ не выдан, кнопки СИМПАС на экране просто нет — вместо кнопки,
// которая при нажатии падает.
import { EMAIL_DOOR, isSimpasIdConfigured, shouldSendToSimpasId } from "@/lib/auth/simpasid"
import { safeReturnPath } from "@/lib/auth/return-path"
import { fetchSimpasIdLegalLinks } from "@/lib/auth/simpasid-legal"
import AuthForm from "./AuthForm"
import SimpasIdDoor from "./SimpasIdDoor"

/**
 * Страница считается заново на каждый запрос, а не собирается заранее.
 *
 * Без этой строки Next.js пререндерил /auth во время `next build` — то есть
 * ВНУТРИ сборочного образа, где переменных единого входа нет и быть не
 * может. Ответ «провайдер не настроен» запекался в разметку навсегда:
 * ключ на сервере есть, приложение перезапущено, а кнопки нет и взяться
 * ей неоткуда. Снаружи это выглядит как «ключ не доехал», хотя дело в
 * том, что вопрос задали не в тот момент.
 *
 * Цена — обычный серверный рендер лёгкой страницы на каждый вход. Плата
 * за то, чтобы состав экрана зависел от настройки сервера, а не от того,
 * что знал сборщик.
 */
export const dynamic = "force-dynamic"

export default async function AuthPage({
    searchParams,
}: {
    searchParams: Promise<{ door?: string; next?: string }>
}) {
    const { door, next } = await searchParams
    const configured = isSimpasIdConfigured()

    // Дверь по умолчанию — единый вход; правило и его цена расписаны в
    // shouldSendToSimpasId. Форма с кнопками остаётся запасной дверью и
    // единственной, пока ключ единого входа не выдан.
    if (shouldSendToSimpasId({ configured, door })) {
        // Возврат разбирается здесь, на сервере: тот же строгий разбор
        // против открытой переадресации, что у ручных кнопок. Бот на
        // пересланный контакт отвечает ссылкой /diary/clients?attest=1, и
        // потерять её значит увести человека на «Сегодня» ровно тогда,
        // когда он шёл подписывать аттестацию.
        const returnPath = safeReturnPath(next)
        // Запасная дверь помнит тот же возврат — иначе вход по почте
        // приводил бы человека не туда, куда привёл бы единый вход.
        const emailDoor = new URLSearchParams({ door: EMAIL_DOOR })
        if (next) emailDoor.set('next', next)

        return <SimpasIdDoor returnPath={returnPath} emailDoorHref={`/auth?${emailDoor.toString()}`} />
    }

    // Адреса документов спрашиваются у консент-центра на каждый показ
    // экрана: редакция там может смениться в любой день, а константа в коде
    // означала бы, что до нашей правки человек читает устаревший текст.
    // Не ответили — ведём на наши прежние страницы, экран входа не имеет
    // права не открыться из-за стороннего сервиса.
    const legalLinks = await fetchSimpasIdLegalLinks()

    return <AuthForm simpasIdEnabled={configured} legalLinks={legalLinks} />
}
