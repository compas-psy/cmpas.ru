'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

type DatePickerProps = {
    value?: Date | string;
    onChange: (date: Date) => void;
    label?: string;
    placeholder?: string;
    className?: string;
};

export function DatePicker({ value, onChange, label, placeholder = 'Выберите дату', className = '' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse value to Date
    const selectedDate = value ? new Date(value) : undefined;

    useEffect(() => {
        if (selectedDate && !isNaN(selectedDate.getTime())) {
            setViewDate(selectedDate);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const months = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const getDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        const days = [];

        // Find first day of month
        const firstDay = new Date(year, month, 1);
        // Adjust for Monday start (0=Sun -> 6, 1=Mon -> 0)
        let firstDayIndex = firstDay.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;

        // Previous month days
        for (let i = firstDayIndex; i > 0; i--) {
            const prevDate = new Date(year, month, 1 - i);
            days.push({ date: prevDate, isCurrentMonth: false });
        }

        // Current month days
        while (date.getMonth() === month) {
            days.push({ date: new Date(date), isCurrentMonth: true });
            date.setDate(date.getDate() + 1);
        }

        // Next month days to fill 42 (6 weeks)
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            const nextDate = new Date(year, month + 1, i);
            days.push({ date: nextDate, isCurrentMonth: false });
        }

        return days;
    };

    const days = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());

    const handleDateClick = (date: Date) => {
        // Correct time zone offset issues by setting hours to 12
        const normalizedDate = new Date(date);
        normalizedDate.setHours(12, 0, 0, 0);
        onChange(normalizedDate);
        setIsOpen(false);
    };

    const formatDate = (d?: Date) => {
        if (!d || isNaN(d.getTime())) return '';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Year range for dropdown (1900 - current + 5)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1900 + 6 }, (_, i) => 1900 + i).reverse();

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && <label className="block text-sm font-medium mb-1">{label}</label>}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between"
            >
                <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
                    {formatDate(selectedDate) || placeholder}
                </span>
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 p-4 min-w-[300px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 gap-2">
                        <button
                            type="button"
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
                            className="p-1 hover:bg-muted rounded"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex gap-1 flex-1 justify-center">
                            <select
                                value={viewDate.getMonth()}
                                onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value)))}
                                className="p-1 text-sm border-none bg-transparent font-medium cursor-pointer focus:outline-none hover:bg-muted rounded"
                            >
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select
                                value={viewDate.getFullYear()}
                                onChange={(e) => setViewDate(new Date(Number(e.target.value), viewDate.getMonth()))}
                                className="p-1 text-sm border-none bg-transparent font-medium cursor-pointer focus:outline-none hover:bg-muted rounded"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
                            className="p-1 hover:bg-muted rounded"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Week days */}
                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map(d => (
                            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                            const isSelected = selectedDate &&
                                day.date.getDate() === selectedDate.getDate() &&
                                day.date.getMonth() === selectedDate.getMonth() &&
                                day.date.getFullYear() === selectedDate.getFullYear();

                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleDateClick(day.date)}
                                    className={`
                                        h-8 w-8 rounded-full text-sm flex items-center justify-center transition-colors
                                        ${!day.isCurrentMonth ? 'text-muted-foreground/30' : 'text-foreground hover:bg-muted'}
                                        ${isSelected ? 'bg-primary text-white hover:bg-primary/90' : ''}
                                        ${day.date.toDateString() === new Date().toDateString() && !isSelected ? 'border border-primary text-primary' : ''}
                                    `}
                                >
                                    {day.date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
