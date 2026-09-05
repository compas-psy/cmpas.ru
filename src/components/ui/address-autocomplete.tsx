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

export default function AddressAutocomplete({ value, onChange, placeholder, className }: Props) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
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
            const data = await res.json();
            if (controller.signal.aborted) return;
            setSuggestions(data.suggestions || []);
            setShowDropdown(true);
        } catch {
            if (controller.signal.aborted) return;
            setSuggestions([]);
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
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder={placeholder}
                className={className}
                autoComplete="off"
            />
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
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
