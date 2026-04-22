'use client';

import { StickyNote, Sparkles } from 'lucide-react';

export default function NotesPage() {
    return (
        <div className="space-y-8 pb-12">
            <div>
                <h1 className="text-[40px] font-bold tracking-tight text-foreground leading-[44px]">Заметки</h1>
                <p className="text-muted-foreground text-[15px] mt-2">Профессиональные заметки по сессиям с AI-помощником</p>
            </div>
            <div className="flex flex-col items-center justify-center py-24 px-8">
                <div className="w-20 h-20 bg-sage-100 rounded-3xl flex items-center justify-center mb-6">
                    <StickyNote className="w-10 h-10 text-forest-600" />
                </div>
                <h2 className="text-hero-title text-foreground mb-3 text-center">Скоро появится</h2>
                <p className="text-body-secondary text-muted-foreground text-center max-w-md">
                    Структурированные заметки по сессиям с блоковым редактором, тегами и AI-помощником.
                    Мы работаем над этим разделом.
                </p>
                <div className="flex items-center gap-2 mt-6 px-4 py-2 bg-sage-50 border border-sage-200 rounded-full">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-small-meta text-muted-foreground font-semibold">В разработке</span>
                </div>
            </div>
        </div>
    );
}
