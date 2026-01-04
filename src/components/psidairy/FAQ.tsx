"use client";
import { useState } from 'react';

export default function FAQ() {
    // All items collapsed by default
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const questions = [
        {
            question: "Кому подходит ежедневник?",
            answer: "Психологам и специалистам помогающих практик, которым важна структура: анкета клиента, записи сессий и отдельное место под супервизию."
        },
        {
            question: "Сколько клиентов \"помещается\"?",
            answer: "Внутри — 20 анкет клиентов, каждая на 2 страницы."
        },
        {
            question: "Что есть на странице сессии?",
            answer: "Поля: ФИО, дата, № сессии. Дальше — пространство под заметки в вашем стиле."
        },
        {
            question: "Что есть в анкете клиента?",
            answer: "Персональная информация, контекст, стресс и опоры, история терапии, цели и ожидания, примечания психолога."
        },
        {
            question: "Есть ли раздел для супервизии?",
            answer: "Да. Раздел \"Супервизия\" с полями \"Случай\"."
        },
        {
            question: "Какая у ежедневника \"физика\"?",
            answer: "Формат A5, 272 страницы, резинка и лента-закладка, обложка глубокого зелёного цвета с тиснением."
        },
        {
            question: "Как доставляете?",
            answer: "Отправляем из Москвы. Подберём вариант под ваш город и сроки."
        },
        {
            question: "Если нужен опт?",
            answer: "Можно заказать несколько экземпляров для центра, школы или команды. Напишите — предложим вариант."
        }
    ];

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id="faq" className="py-20 md:py-24 bg-[#F2F2F2]">
            <div className="container mx-auto px-4 max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-medium text-center mb-10 text-primary">
                    FAQ
                </h2>

                <div className="space-y-3">
                    {questions.map((item, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-lg overflow-hidden shadow-sm transition-all duration-300"
                        >
                            <button
                                onClick={() => toggleFAQ(idx)}
                                className="w-full text-left px-5 py-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
                            >
                                <span className="text-primary font-medium text-sm pr-4">
                                    {item.question}
                                </span>
                                <span className={`text-primary/60 transition-transform duration-300 ${openIndex === idx ? 'rotate-180' : ''}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </span>
                            </button>

                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === idx ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <div className="px-5 pb-5 pt-0 text-foreground/70 text-sm leading-relaxed text-[13px]">
                                    {item.answer}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
