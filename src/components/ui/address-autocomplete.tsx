'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Suggestion = {
    value: string;
    data: {
        fias_id?: string;
        city?: string;
        street?: string;
        house?: string;
        block?: string;
        region?: string;
    };
};

type Props = {
    value: string;
    onChange: (value: string, suggestion?: Suggestion) => void;
    placeholder?: string;
    className?: string;
};

/**
 * Задача 19: у подсказок ДВА разных пустых состояния, и путать их нельзя.
 * «Ничего не нашли» — адрес редкий, можно дописать руками. «Недоступны» —
 * сломана интеграция; если показывать вместо этого пустой список, о поломке
 * никто не узнает. Поле ввода в обоих случаях остаётся обычным текстовым и
 * никогда не очищается: набранный адрес принадлежит специалисту, а не
 * подсказкам.
 */
type SuggestState = 'idle' | 'ready' | 'empty' | 'unavailable';

const UNAVAILABLE_TEXT = 'Подсказки временно недоступны. Введите адрес вручную.';
const EMPTY_TEXT = 'Ничего не нашли — адрес можно ввести вручную.';

export default function AddressAutocomplete({ value, onChange, placeholder, className }: Props) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [state, setState] = useState<SuggestState>('idle');
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Задача 19: ответ на устаревший запрос не должен затирать свежий. Пока
    // отменялся только таймер дебаунса, два запроса в полёте могли вернуться
    // в обратном порядке — и в списке оказывались подсказки к тому, что
    // специалист уже дописал.
    const abortRef = useRef<AbortController | null>(null);

    const fetchSuggestions = useCallback(async (query: string) => {
        abortRef.current?.abort();
        if (query.trim().length < 3) {
            setSuggestions([]);
            setState('idle');
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const res = await fetch('/api/dadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;

            if (!res.ok) {
                setSuggestions([]);
                // 400 — наша же недоработка в запросе, а не поломка сервиса:
                // человеку сообщать не о чем, подсказок просто нет.
                setState(res.status === 400 ? 'idle' : 'unavailable');
                setShowDropdown(res.status !== 400);
                setLoading(false);
                return;
            }

            const data = await res.json();
            if (controller.signal.aborted) return;
            const found: Suggestion[] = data.suggestions || [];
            setSuggestions(found);
            setState(found.length > 0 ? 'ready' : 'empty');
            setShowDropdown(true);
        } catch {
            // Сеть не дошла — для человека это то же самое, что недоступный
            // сервис: подсказок нет, поле работает.
            if (controller.signal.aborted) return;
            setSuggestions([]);
            setState('unavailable');
            setShowDropdown(true);
        }
        if (!controller.signal.aborted) setLoading(false);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    };

    const handleSelect = (s: Suggestion) => {
        onChange(s.value, s);
        setShowDropdown(false);
        setSuggestions([]);
        setState('idle');
    };

    // Незавершённый запрос и таймер дебаунса не должны пережить размонтирование.
    useEffect(() => () => {
        abortRef.current?.abort();
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={wrapperRef} className="relative">
            <input
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => (suggestions.length > 0 || state === 'unavailable') && setShowDropdown(true)}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
            )}
            {showDropdown && suggestions.length === 0 && (state === 'unavailable' || state === 'empty') && (
                <div
                    role="status"
                    data-testid="suggest-notice"
                    className="absolute z-[999] w-full bottom-full mb-1 bg-white border border-border rounded-lg shadow-lg px-3 py-2.5 text-sm text-muted-foreground"
                >
                    {state === 'unavailable' ? UNAVAILABLE_TEXT : EMPTY_TEXT}
                </div>
            )}
            {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-[999] w-full bottom-full mb-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    style={{ filter: 'drop-shadow(0 -4px 12px rgba(0,0,0,0.1))' }}>

                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleSelect(s)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors border-b border-border/30 last:border-b-0"
                        >
                            {s.value}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
