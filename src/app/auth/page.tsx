// Страница входа. Серверная обёртка над формой.
//
// Обёртка нужна ровно для одного: узнать, настроен ли единый вход СИМПАС.
// Форма — клиентская (нажатия, состояние поля почты), а переменные с
// ключом провайдера живут только на сервере и в браузер не отдаются.
// Пока ключ не выдан, кнопки СИМПАС на экране просто нет — вместо кнопки,
// которая при нажатии падает.
import { isSimpasIdConfigured } from "@/lib/auth/simpasid"
import AuthForm from "./AuthForm"

export default function AuthPage() {
    return <AuthForm simpasIdEnabled={isSimpasIdConfigured()} />
}
