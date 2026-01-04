"use client";
import { useState, useRef, useEffect } from 'react';

import { submitOrder } from '@/app/actions';

export default function OrderForm() {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        method: ''
    });

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        let formattedValue = '';
        if (value.length > 0) {
            formattedValue = '+7';
            if (value.length > 1) formattedValue += ' (' + value.slice(1, 4);
            if (value.length > 4) formattedValue += ') ' + value.slice(4, 7);
            if (value.length > 7) formattedValue += '-' + value.slice(7, 9);
            if (value.length > 9) formattedValue += '-' + value.slice(9, 11);
        }

        setFormData({ ...formData, phone: formattedValue });
    };

    const options = [
        { value: 'telegram', label: 'Telegram' },
        { value: 'whatsapp', label: 'Max' },
        { value: 'call', label: 'WhatsApp' }
    ];

    const selectOption = (value: string) => {
        setFormData({ ...formData, method: value });
        setIsDropdownOpen(false);
        // Clear validation error manually when user selects an option
        if (hiddenInputRef.current) {
            hiddenInputRef.current.setCustomValidity('');
        }
    };

    const getSelectedLabel = () => {
        const option = options.find(opt => opt.value === formData.method);
        return option ? option.label : 'Выберите способ связи';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final validation check
        if (!formData.name || !formData.phone || !formData.method) {
            return;
        }

        const result = await submitOrder(formData);

        if (result.success) {
            alert('Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.');
            setFormData({ name: '', phone: '', method: '' });
        } else {
            alert('Произошла ошибка при отправке: ' + result.message);
        }
    };

    return (
        <section id="order-form" className="py-20 bg-background min-h-[600px] flex items-center justify-center">
            <div className="container mx-auto px-4">
                <div className="max-w-[520px] mx-auto bg-[#FAFAFA] px-10 py-12 rounded-lg border border-primary shadow-sm relative">

                    <h2 className="text-2xl font-medium text-center mb-3 text-primary">Оформить заказ</h2>
                    <p className="text-center text-foreground/60 text-[13px] mb-10 max-w-sm mx-auto leading-relaxed">
                        Заполните форму, и мы свяжемся с вами для подтверждения заказа
                    </p>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-foreground ml-1">Имя *</label>
                            <input
                                type="text"
                                placeholder="Как к вам обращаться"
                                className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition text-sm placeholder:text-gray-400 text-foreground"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Пожалуйста, заполните это поле')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                required
                            />
                        </div>

                        {/* Phone Input */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-foreground ml-1">Номер телефона *</label>
                            <input
                                type="tel"
                                placeholder="+7 (___) ___-__-__"
                                className="w-full h-12 px-4 rounded-lg border border-gray-200 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition text-sm placeholder:text-gray-400 text-foreground"
                                value={formData.phone}
                                onChange={handlePhoneChange}
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Пожалуйста, заполните это поле')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                                required
                            />
                        </div>

                        {/* Custom Select */}
                        <div className="space-y-1.5 relative" ref={dropdownRef}>
                            <label className="block text-[11px] font-bold text-foreground ml-1">Способ связи *</label>

                            {/* Hidden Input for Validation */}
                            <input
                                ref={hiddenInputRef}
                                type="text"
                                value={formData.method}
                                onChange={() => { }}
                                required
                                className="absolute bottom-0 left-0 w-full h-12 opacity-0 -z-10 pointer-events-none"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Пожалуйста, выберите способ связи')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                            />

                            <div
                                className={`w-full h-12 px-4 rounded-lg border border-gray-200 bg-white flex items-center justify-between cursor-pointer transition select-none ${isDropdownOpen ? 'border-primary ring-1 ring-primary' : ''}`}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span className={`text-sm ${formData.method ? 'text-foreground' : 'text-gray-400'}`}>
                                    {getSelectedLabel()}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-lg shadow-xl overflow-hidden z-20 py-1">
                                    {options.map((option) => (
                                        <div
                                            key={option.value}
                                            onClick={() => selectOption(option.value)}
                                            className="px-4 py-3 text-sm cursor-pointer hover:bg-accent hover:text-white transition-colors text-foreground"
                                        >
                                            {option.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-primary text-white h-12 rounded-lg font-bold hover:bg-[#1B3C35] transition shadow-md mt-4 text-[13px]"
                        >
                            Отправить заявку
                        </button>

                        <p className="text-[10px] text-gray-400 text-center mt-4">
                            * Все поля обязательны для заполнения
                        </p>
                    </form>
                </div>
            </div>
        </section>
    );
}
