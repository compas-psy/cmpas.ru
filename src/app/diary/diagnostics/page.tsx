'use client';

import { Stethoscope, Sparkles } from 'lucide-react';

export default function DiagnosticsPage() {
    return (
        <div className="space-y-8 pb-12">
            <div>
                <h1 className="text-[40px] font-bold tracking-tight text-foreground leading-[44px]">Диагностика</h1>
                <p className="text-muted-foreground text-[15px] mt-2">Тесты и опросники для клиентов</p>
            </div>
            <div className="flex flex-col items-center justify-center py-24 px-8">
                <div className="w-20 h-20 bg-sage-100 rounded-3xl flex items-center justify-center mb-6">
                    <Stethoscope className="w-10 h-10 text-forest-600" />
                </div>
                <h2 className="text-hero-title text-foreground mb-3 text-center">Скоро появится</h2>
                <p className="text-body-secondary text-muted-foreground text-center max-w-md">
                    Валидированные опросники (PHQ-9, GAD-7, BDI-II и др.), назначение клиентам,
                    автоматический подсчёт баллов и динамика по сессиям.
                </p>
                <div className="flex items-center gap-2 mt-6 px-4 py-2 bg-sage-50 border border-sage-200 rounded-full">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-small-meta text-muted-foreground font-semibold">В разработке</span>
                </div>
            </div>
        </div>
    );
}
