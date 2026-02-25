'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PhoneInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string;
    onChange?: (value: string) => void;
}

const formatPhoneNumber = (value: string) => {
    // Убираем все нецифровые символы
    let numbers = value.replace(/\D/g, '');

    // Если ничего нет
    if (numbers.length === 0) return '';

    // Если начинается с 8 — меняем на 7
    // Если начинается не с 7 (и не с 8, так как 8 уже обработано) — добавляем 7
    if (numbers[0] === '8') {
        numbers = '7' + numbers.slice(1);
    } else if (numbers[0] !== '7') {
        numbers = '7' + numbers;
    }

    // Ограничиваем длину 11 цифрами
    numbers = numbers.slice(0, 11);

    // Форматируем по маске: +7 (xxx) xxx-xx-xx
    let formatted = '+7';
    if (numbers.length > 1) {
        formatted += ' (' + numbers.slice(1, 4);
    }
    if (numbers.length >= 5) {
        formatted += ') ' + numbers.slice(4, 7);
    }
    if (numbers.length >= 8) {
        formatted += '-' + numbers.slice(7, 9);
    }
    if (numbers.length >= 10) {
        formatted += '-' + numbers.slice(9, 11);
    }

    return formatted;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
    ({ className, value, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const formatted = formatPhoneNumber(e.target.value);
            if (onChange) {
                // Передаем отформатированное значение
                onChange(formatted);
            }
        };

        return (
            <input
                type="tel"
                className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                value={value || ''}
                onChange={handleChange}
                placeholder="+7 (___) ___-__-__"
                {...props}
            />
        );
    }
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
