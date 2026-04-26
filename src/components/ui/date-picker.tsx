'use client';

import { useState, useEffect, useRef } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

registerLocale('ru', ru);

type DatePickerProps = {
    value?: Date | string | null;
    onChange: (date: Date | null) => void;
    label?: string;
    placeholder?: string;
    className?: string;
};

export function DatePicker({ value, onChange, label, placeholder = 'Выберите дату', className = '' }: DatePickerProps) {
    const selectedDate = value ? (typeof value === 'string' ? new Date(value) : value) : null;

    return (
        <div className={`relative ${className}`}>
            {label && <label className="block text-sm font-medium mb-1">{label}</label>}
            <div className="relative [&_.react-datepicker-wrapper]:w-full [&_.react-datepicker__input-container]:w-full [&_.react-datepicker-popper]:!z-[9999]">
                <ReactDatePicker
                    selected={selectedDate}
                    onChange={(date: Date | null) => onChange(date)}
                    locale="ru"
                    dateFormat="dd.MM.yyyy"
                    placeholderText={placeholder}
                    popperPlacement="bottom-start"
                    popperModifiers={[{ name: 'preventOverflow', options: { boundary: 'viewport' } }]}
                    className="w-full px-3 py-2 pr-9 border border-border rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <CalendarIcon className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}

type TimePickerProps = {
    value?: string; // Expects "HH:mm" format
    onChange: (time: string) => void;
    label?: string;
    className?: string;
};

export function TimePicker({ value, onChange, label, className = '' }: TimePickerProps) {
    // Convert HH:mm string to a Date object for the picker
    const selectedDate = value ? new Date(`1970-01-01T${value}:00`) : null;

    const handleChange = (date: Date | null) => {
        if (!date) return;
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        onChange(`${hours}:${minutes}`);
    };

    return (
        <div className={`relative ${className}`}>
            {label && <label className="block text-sm font-medium mb-1">{label}</label>}
            <div className="relative [&_.react-datepicker-wrapper]:w-full [&_.react-datepicker__input-container]:w-full [&_.react-datepicker-popper]:!z-[9999]">
                <ReactDatePicker
                    selected={selectedDate}
                    onChange={handleChange}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Время"
                    dateFormat="HH:mm"
                    timeFormat="HH:mm"
                    className="w-full px-3 py-2 pr-9 border border-border rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Clock className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}
