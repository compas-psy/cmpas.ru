"use client";

import { useState } from "react";

// Умные тэги по умолчанию
const SMART_TAGS = [
    { id: "request", label: "Запрос", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    { id: "anamnesis", label: "Анамнез", color: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
    { id: "observation", label: "Наблюдение", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
    { id: "intervention", label: "Интервенция", color: "bg-green-100 text-green-700 hover:bg-green-200" },
    { id: "resources", label: "Ресурсы", color: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
    { id: "dynamics", label: "Динамика", color: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" },
    { id: "homework", label: "Домашнее задание", color: "bg-pink-100 text-pink-700 hover:bg-pink-200" },
    { id: "next_step", label: "Следующий шаг", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
];

interface SmartBlock {
    id: string; // unique block id
    tagId: string;
    content: string;
}

export function SmartEditor() {
    const [blocks, setBlocks] = useState<SmartBlock[]>([]);
    const [flatNote, setFlatNote] = useState("");

    const handleAddTag = (tagId: string) => {
        // В будущем тут можно сделать фокус на добавленный блок
        setBlocks((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                tagId,
                content: "",
            },
        ]);
    };

    const updateBlockContent = (id: string, content: string) => {
        setBlocks((prev) =>
            prev.map((block) => (block.id === id ? { ...block, content } : block))
        );
    };

    const removeBlock = (id: string) => {
        setBlocks((prev) => prev.filter((block) => block.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header & Tags */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Быстрые блоки</h3>
                <div className="flex flex-wrap gap-2">
                    {SMART_TAGS.map((tag) => (
                        <button
                            key={tag.id}
                            onClick={() => handleAddTag(tag.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${tag.color}`}
                        >
                            + {tag.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Structured Blocks */}
                {blocks.map((block) => {
                    const tagInfo = SMART_TAGS.find((t) => t.id === block.tagId);
                    return (
                        <div key={block.id} className="relative group rounded-xl border border-gray-100 p-4 bg-gray-50/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${tagInfo?.color}`}>
                                    {tagInfo?.label}
                                </span>
                                <button
                                    onClick={() => removeBlock(block.id)}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>
                            <textarea
                                value={block.content}
                                onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                placeholder={`Заполните ${tagInfo?.label.toLowerCase()}...`}
                                className="min-h-[80px] bg-transparent border-none shadow-none focus-visible:ring-0 p-0 text-sm resize-none"
                            />
                        </div>
                    );
                })}

                {/* Flat legacy note (always present) */}
                <div className="pt-2">
                    <textarea
                        value={flatNote}
                        onChange={(e) => setFlatNote(e.target.value)}
                        placeholder="Свободные записи..."
                        className="min-h-[200px] border-none shadow-none focus-visible:ring-0 p-0 text-sm resize-none"
                    />
                </div>
            </div>
        </div>
    );
}
