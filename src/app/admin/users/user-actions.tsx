"use client"

import { useState } from "react"
import { Shield, ShieldAlert, UserCheck, Trash2, RotateCcw, CalendarPlus } from "lucide-react"
import { toggleUserBlock, changeUserRole, resetUserSettings, deleteUserAccount, extendUserTrial } from "../actions/users"
import { useRouter } from "next/navigation"

export function UserActions({
    user
}: {
    user: { id: string; role: string; isBlocked: boolean }
}) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const handleAction = async (action: () => Promise<any>) => {
        setIsLoading(true)
        try {
            await action()
            router.refresh()
        } catch (error) {
            console.error("Action failed:", error)
            alert("Произошла ошибка при выполнении действия.")
        } finally {
            setIsLoading(false)
        }
    }

    if (user.role === 'SUPERADMIN') {
        return <span className="text-xs text-muted-foreground">Недоступно</span>
    }

    return (
        <div className="flex justify-end gap-1">
            <button
                disabled={isLoading}
                onClick={() => handleAction(() => toggleUserBlock(user.id, !user.isBlocked))}
                className={`p-2 rounded-md hover:bg-muted transition-colors ${user.isBlocked ? 'text-emerald-600' : 'text-foreground/60'}`}
                title={user.isBlocked ? "Разблокировать" : "Заблокировать"}
            >
                {user.isBlocked ? <Shield className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </button>

            <button
                disabled={isLoading}
                onClick={() => handleAction(() => changeUserRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN'))}
                className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/60 hover:text-emerald-600"
                title={user.role === 'ADMIN' ? "Забрать права админа" : "Сделать админом"}
            >
                <UserCheck className="w-4 h-4" />
            </button>

            <button
                disabled={isLoading}
                onClick={() => {
                    if (confirm("Продлить триал на 30 дней от текущей даты окончания?")) {
                        handleAction(() => extendUserTrial(user.id, 30))
                    }
                }}
                className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/60 hover:text-amber-600"
                title="Продлить триал на 30 дней"
            >
                <CalendarPlus className="w-4 h-4" />
            </button>

            <button
                disabled={isLoading}
                onClick={() => {
                    if (confirm("Вы уверены, что хотите сбросить настройки онбординга этого пользователя? Он потеряет свое расписание.")) {
                        handleAction(() => resetUserSettings(user.id))
                    }
                }}
                className="p-2 rounded-md hover:bg-muted transition-colors text-foreground/60 hover:text-blue-500"
                title="Сбросить профиль (вернуть на онбординг)"
            >
                <RotateCcw className="w-4 h-4" />
            </button>

            <button
                disabled={isLoading}
                onClick={() => {
                    if (confirm("Вы ТОЧНО хотите удалить этого пользователя навсегда? Это действие необратимо и удалит всех его клиентов и сессии!")) {
                        handleAction(() => deleteUserAccount(user.id))
                    }
                }}
                className="p-2 rounded-md hover:bg-destructive/10 transition-colors text-destructive/70 hover:text-destructive"
                title="Удалить аккаунт навсегда"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}
