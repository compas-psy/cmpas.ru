"use client"

import { useState, useRef, useEffect } from "react"
import {
    Shield, ShieldAlert, UserCheck, Trash2, RotateCcw, RefreshCw,
    Infinity, Send, Mail, MessageCircle, MoreHorizontal, TestTube,
} from "lucide-react"
import {
    toggleUserBlock, changeUserRole, resetUserSettings, deleteUserAccount,
    extendUserTrial, resetUserTrialFromNow, setUserTrialForever,
    testModeReset, sendTelegramMessage,
} from "../actions/users"
import { useRouter } from "next/navigation"

export function UserActions({
    user
}: {
    user: { id: string; role: string; isBlocked: boolean; telegramChatId?: string | null; email?: string }
}) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [message, setMessage] = useState('')

    const handleAction = async (action: () => Promise<any>) => {
        setIsLoading(true)
        setShowMenu(false)
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

    const handleSendMessage = async () => {
        if (!message.trim()) return
        setIsLoading(true)
        try {
            const result = await sendTelegramMessage(user.id, message.trim())
            if (result.success) {
                alert('Сообщение отправлено!')
                setMessage('')
                setShowMessageModal(false)
            } else {
                alert(`Ошибка: ${result.error}`)
            }
        } catch {
            alert('Не удалось отправить сообщение')
        } finally {
            setIsLoading(false)
        }
    }

    if (user.role === 'SUPERADMIN') {
        return <span className="text-[10px] text-[#94a3b8]">Защищён</span>
    }

    const btnRef = useRef<HTMLButtonElement>(null)
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

    useEffect(() => {
        if (showMenu && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            const menuHeight = 420 // approximate max height
            const spaceBelow = window.innerHeight - rect.bottom
            const top = spaceBelow < menuHeight
                ? Math.max(8, rect.top - menuHeight + rect.height)
                : rect.bottom + 4
            setMenuPos({
                top,
                left: Math.max(8, rect.right - 224), // 224 = w-56 = 14rem
            })
        }
    }, [showMenu])

    return (
        <>
            <div className="relative">
                <button
                    ref={btnRef}
                    onClick={() => setShowMenu(!showMenu)}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg hover:bg-[#f1f5f9] transition-colors text-[#94a3b8] hover:text-[#334155]"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>

                {showMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                        <div
                            className="fixed z-50 w-56 bg-white rounded-xl shadow-lg border border-[#e2e8f0] py-1.5 animate-in fade-in slide-in-from-top-1 duration-150 max-h-[80vh] overflow-y-auto"
                            style={{ top: menuPos.top, left: menuPos.left }}
                        >
                            {/* Block / Unblock */}
                            <button
                                onClick={() => handleAction(() => toggleUserBlock(user.id, !user.isBlocked))}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                {user.isBlocked
                                    ? <><Shield className="w-4 h-4 text-emerald-500" /> <span>Разблокировать</span></>
                                    : <><ShieldAlert className="w-4 h-4 text-amber-500" /> <span>Заблокировать</span></>
                                }
                            </button>

                            {/* Role */}
                            <button
                                onClick={() => handleAction(() => changeUserRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN'))}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                <UserCheck className="w-4 h-4 text-indigo-500" />
                                <span>{user.role === 'ADMIN' ? 'Забрать права админа' : 'Сделать админом'}</span>
                            </button>

                            <div className="h-px bg-[#f1f5f9] my-1" />

                            {/* Trial Actions */}
                            <button
                                onClick={() => {
                                    if (confirm("Сбросить триал: 30 дней от сегодня?")) {
                                        handleAction(() => resetUserTrialFromNow(user.id, 30))
                                    }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                <RefreshCw className="w-4 h-4 text-sky-500" />
                                <span>Триал: 30 дней от сегодня</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (confirm("Установить бесконечный доступ?")) {
                                        handleAction(() => setUserTrialForever(user.id))
                                    }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                <Infinity className="w-4 h-4 text-emerald-500" />
                                <span>Бесплатно навсегда</span>
                            </button>

                            <div className="h-px bg-[#f1f5f9] my-1" />

                            {/* Communication */}
                            {user.telegramChatId && (
                                <button
                                    onClick={() => { setShowMenu(false); setShowMessageModal(true); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                                >
                                    <Send className="w-4 h-4 text-sky-500" />
                                    <span>Написать в Telegram</span>
                                </button>
                            )}

                            {user.email && (
                                <a
                                    href={`mailto:${user.email}`}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors"
                                >
                                    <Mail className="w-4 h-4 text-amber-500" />
                                    <span>Написать email</span>
                                </a>
                            )}

                            <div className="h-px bg-[#f1f5f9] my-1" />

                            {/* Dangerous actions */}
                            <button
                                onClick={() => {
                                    if (confirm("Сбросить онбординг? Настройки расписания будут удалены.")) {
                                        handleAction(() => resetUserSettings(user.id))
                                    }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                <RotateCcw className="w-4 h-4 text-blue-500" />
                                <span>Сбросить онбординг</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (confirm("⚠️ ТЕСТОВЫЙ РЕЖИМ: Удалить ВСЕ данные пользователя (клиенты, сессии, настройки)? Это необратимо!")) {
                                        if (confirm("Вы уверены? Все клиенты и сессии будут удалены безвозвратно!")) {
                                            handleAction(() => testModeReset(user.id))
                                        }
                                    }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-amber-50 transition-colors text-left text-amber-700"
                            >
                                <TestTube className="w-4 h-4" />
                                <span>Тестовый режим (полный сброс)</span>
                            </button>

                            <button
                                onClick={() => {
                                    if (confirm("УДАЛИТЬ АККАУНТ НАВСЕГДА? Это необратимо!")) {
                                        handleAction(() => deleteUserAccount(user.id))
                                    }
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-50 transition-colors text-left text-red-600"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Удалить аккаунт</span>
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Telegram Message Modal */}
            {showMessageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowMessageModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <MessageCircle className="w-5 h-5 text-sky-500" />
                            <h3 className="font-semibold text-[#0f1729]">Отправить в Telegram</h3>
                        </div>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Текст сообщения..."
                            rows={4}
                            className="w-full p-3 rounded-xl border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowMessageModal(false)}
                                className="flex-1 h-10 rounded-xl border border-[#e2e8f0] text-sm font-medium hover:bg-[#f8fafc] transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !message.trim()}
                                className="flex-1 h-10 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Отправка...' : 'Отправить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
