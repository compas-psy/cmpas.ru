"use client"

import { useState, useEffect } from "react"
import { getAdminLegalDocs, setActiveLegalDoc, createLegalDoc, deleteLegalDoc, resetMyLegalAcceptance } from "./actions"
import { Shield, FileText, Plus, Upload, Trash2, CheckCircle2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

type LegalDoc = {
    id: string
    type: "TERMS" | "PRIVACY" | "ADS"
    version: string
    url: string
    isActive: boolean
    publishedAt: Date
}

export default function AdminLegalPage() {
    const [docs, setDocs] = useState<LegalDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)

    // Form state
    const [newDocType, setNewDocType] = useState<"TERMS" | "PRIVACY" | "ADS">("TERMS")
    const [newDocVersion, setNewDocVersion] = useState("v1.0")
    const [newDocFile, setNewDocFile] = useState<File | null>(null)
    const [newDocIsActive, setNewDocIsActive] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        loadDocs()
    }, [])

    const loadDocs = async () => {
        const res = await getAdminLegalDocs()
        if (res.success && res.data) {
            setDocs(res.data as LegalDoc[])
        } else {
            toast.error(res.error)
        }
        setLoading(false)
    }

    const handleSetActive = async (id: string, type: "TERMS" | "PRIVACY" | "ADS") => {
        const res = await setActiveLegalDoc(id, type)
        if (res.success) {
            toast.success("Активный документ обновлен")
            loadDocs()
        } else {
            toast.error(res.error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Удалить этот документ? Убедитесь, что никто его не принимал, иначе возникнет ошибка.")) return
        const res = await deleteLegalDoc(id)
        if (res.success) {
            toast.success("Документ удален")
            loadDocs()
        } else {
            toast.error(res.error)
        }
    }

    const [resetting, setResetting] = useState(false)
    const handleResetMine = async () => {
        if (!confirm("Сбросить ваше согласие на все документы? Вы сразу увидите экран /legal-acceptance заново — это только для тестирования, других пользователей это не затронет.")) return
        setResetting(true)
        try {
            await resetMyLegalAcceptance()
            toast.success("Согласие сброшено. Откройте /legal-acceptance, чтобы увидеть экран.")
        } catch (error: any) {
            toast.error(error?.message || "Не удалось сбросить согласие")
        } finally {
            setResetting(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDocFile) {
            toast.error("Выберите PDF файл")
            return
        }

        setUploading(true)
        try {
            // 1. Upload file
            const formData = new FormData()
            formData.append("file", newDocFile)

            const uploadRes = await fetch("/api/admin/upload", {
                method: "POST",
                body: formData
            })

            const uploadData = await uploadRes.json()

            if (!uploadRes.ok || !uploadData.success) {
                toast.error(uploadData.error || "Ошибка загрузки файла")
                setUploading(false)
                return
            }

            // 2. Create record
            const res = await createLegalDoc({
                type: newDocType,
                version: newDocVersion,
                url: uploadData.url,
                isActive: newDocIsActive
            })

            if (res.success) {
                toast.success("Новая версия документа создана")
                setIsAdding(false)
                setNewDocFile(null)
                loadDocs()
            } else {
                toast.error(res.error)
            }
        } catch (error) {
            toast.error("Произошла ошибка")
        }
        setUploading(false)
    }

    if (loading) return <div className="p-8"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

    const termsDocs = docs.filter(d => d.type === "TERMS")
    const privacyDocs = docs.filter(d => d.type === "PRIVACY")
    const adsDocs = docs.filter(d => d.type === "ADS")

    const renderDocList = (title: string, list: LegalDoc[], type: "TERMS" | "PRIVACY" | "ADS") => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    {title}
                </h2>
                <button
                    onClick={() => {
                        setNewDocType(type)
                        setIsAdding(true)
                    }}
                    className="flex items-center gap-1 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" /> Добавить версию
                </button>
            </div>

            {list.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded-xl">Нет загруженных версий</p>
            ) : (
                <div className="space-y-3">
                    {list.map(doc => (
                        <div key={doc.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all ${doc.isActive ? "border-primary bg-primary/5" : "border-gray-200"}`}>
                            <div className="flex items-center gap-4">
                                <FileText className={`w-8 h-8 ${doc.isActive ? "text-primary" : "text-gray-400"}`} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-gray-900">Версия {doc.version}</p>
                                        {doc.isActive && <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">АКТИВНА</span>}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Загружен: {new Date(doc.publishedAt).toLocaleDateString("ru-RU")}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <a href={doc.url} target="_blank" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">
                                    Скачать
                                </a>
                                {!doc.isActive && (
                                    <button
                                        onClick={() => handleSetActive(doc.id, doc.type)}
                                        className="text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Сделать активной
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Юридические документы</h1>
                <button
                    onClick={handleResetMine}
                    disabled={resetting}
                    className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    title="Удаляет ваши записи о согласии, чтобы можно было заново увидеть /legal-acceptance"
                >
                    <RotateCcw className="w-4 h-4" /> Сбросить моё согласие (тест)
                </button>
            </div>

            {isAdding && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8 relative animate-in fade-in slide-in-from-top-4">
                    <button onClick={() => setIsAdding(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">×</button>
                    <h3 className="text-xl font-bold mb-4">Новая версия документа</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Тип документа</label>
                                <select value={newDocType} onChange={e => setNewDocType(e.target.value as any)} className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium">
                                    <option value="TERMS">Пользовательское соглашение (TERMS)</option>
                                    <option value="PRIVACY">Политика конфиденциальности (PRIVACY)</option>
                                    <option value="ADS">Согласие на рекламу (ADS)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Версия (напр. v1.1)</label>
                                <input type="text" value={newDocVersion} onChange={e => setNewDocVersion(e.target.value)} required placeholder="v1.0" className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">PDF Файл</label>
                            <div className="flex items-center gap-4">
                                <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-primary rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50 hover:bg-white">
                                    <input type="file" accept=".pdf" className="hidden" onChange={e => setNewDocFile(e.target.files?.[0] || null)} />
                                    <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-600">
                                        {newDocFile ? newDocFile.name : "Нажмите для выбора PDF файла"}
                                    </span>
                                </label>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={newDocIsActive} onChange={e => setNewDocIsActive(e.target.checked)} className="w-5 h-5 rounded text-primary focus:ring-primary" />
                            <span className="text-sm font-bold text-gray-800">Сделать эту версию активной сразу</span>
                        </label>

                        <div className="flex gap-3 pt-4">
                            <button type="submit" disabled={uploading} className="bg-primary text-white rounded-xl px-6 py-2.5 font-bold disabled:opacity-50">
                                {uploading ? "Загрузка..." : "Сохранить документ"}
                            </button>
                            <button type="button" onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-700 rounded-xl px-6 py-2.5 font-bold hover:bg-gray-200">
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {renderDocList("Пользовательское соглашение", termsDocs, "TERMS")}
            {renderDocList("Политика конфиденциальности", privacyDocs, "PRIVACY")}
            {renderDocList("Согласие на рекламу", adsDocs, "ADS")}
        </div>
    )
}
