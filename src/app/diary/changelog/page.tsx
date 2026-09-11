'use client';

import { Shield, Route, Smartphone, Sparkles } from 'lucide-react';

/**
 * «Что нового» — страница, которую человек открывает, чтобы узнать, что
 * изменилось у НЕГО. Поэтому здесь нет ни одной строки про устройство
 * сервиса: прежняя редакция рассказывала про DNS в Docker и таймауты на
 * вызовы API — сведения, по которым психолог не может ни решить, ни
 * сделать ничего.
 *
 * Номера версий — настоящие, из сборки. Прежние 2.4–2.6 не существовали
 * никогда: страница жила своей нумерацией и своим календарём, отстала на
 * четыре месяца и молчала об этом. Чтобы это не повторилось, верхняя
 * запись сверяется со сборкой (`tests/changelog-matches-release.test.ts`):
 * поднялась версия продукта — здесь появилась строка, иначе проверка
 * роняет сборку.
 */
type ChangelogEntry = {
    date: string;
    /** Линия версий, которую описывает запись: «1.3» покрывает 1.3.0–1.3.x. */
    version: string;
    title: string;
    icon: typeof Sparkles;
    color: string;
    items: { text: string; tag?: 'new' | 'fix' | 'improved' }[];
};

const tagStyle = {
    new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    fix: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    improved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const tagLabel = { new: 'Новое', fix: 'Исправлено', improved: 'Улучшено' };

export const changelog: ChangelogEntry[] = [
    {
        date: '11 сентября 2026',
        version: '1.3',
        title: 'Единый вход и оплата перед встречей',
        icon: Shield,
        color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        items: [
            { text: 'Вход по Яндексу, VK и по почте ведёт в одну учётную запись — общую для всех продуктов, а не отдельную для ПРАКТИКИ', tag: 'improved' },
            { text: 'Документы — соглашение, политика и особые условия ПРАКТИКИ — открываются действующей редакцией из одного места', tag: 'improved' },
            { text: 'Если войти не удалось, экран называет причину и второй путь вместо общего «попробуйте позже»', tag: 'fix' },
            { text: 'Перед встречей клиенту уходит напоминание об оплате — за срок, который вы выбираете сами в разделе «Оплата клиентом»', tag: 'new' },
            { text: 'QR-код рисуется из вашей ссылки на оплату: отдельную картинку заводить не нужно, клиент наводит камеру', tag: 'new' },
            { text: 'Код оплаты приходит и в MAX, а не только в Telegram', tag: 'fix' },
            { text: 'ПРАКТИКА не принимает оплату и не видит её поступление: отметку об оплате по-прежнему ставите вы', tag: 'improved' },
        ],
    },
    {
        date: '10 сентября 2026',
        version: '1.2',
        title: 'Путь от встречи до следующей записи',
        icon: Route,
        color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        items: [
            { text: 'После встречи — отметка «Была» или «Не пришли», и запись на следующую прямо оттуда', tag: 'new' },
            { text: 'Тот же час через неделю одной кнопкой; час можно закрепить за клиентом на выбранный срок', tag: 'new' },
            { text: 'Если клиент не пришёл, причину можно записать и перенести встречу в том же окне', tag: 'new' },
            { text: 'У клиента — своя страница встречи: перенос и отмена без переписки', tag: 'new' },
            { text: 'Одно событие — одно сообщение: клиент больше не получает две одинаковые записи подряд', tag: 'fix' },
        ],
    },
    {
        date: '6–10 сентября 2026',
        version: '1.1',
        title: 'Приложение умеет то же, что кабинет',
        icon: Smartphone,
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        items: [
            { text: 'Расписание правится в приложении: часы конкретного дня и блокировка отдельных часов, а не только целого дня', tag: 'new' },
            { text: 'Вместо инициалов — фотография клиента из его мессенджера', tag: 'new' },
            { text: 'Вечерняя отметка: как прошли сегодняшние встречи, одним экраном', tag: 'new' },
            { text: 'Клиент, удалённый в кабинете, исчезает и в приложении', tag: 'fix' },
            { text: 'Время сессии и свободные часы в приложении совпадают с кабинетом', tag: 'fix' },
        ],
    },
    {
        date: 'август 2026',
        version: '1.0',
        title: 'ПРАКТИКА на телефоне',
        icon: Sparkles,
        color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        items: [
            { text: 'Приложение для Android: клиенты, расписание и заметки по сессиям', tag: 'new' },
            { text: 'Самозапись клиентов и напоминания через боты в популярных мессенджерах', tag: 'new' },
            { text: 'Синхронизация с Яндекс и другими календарями', tag: 'new' },
        ],
    },
];

export default function ChangelogPage() {
    return (
        <div className="space-y-6 pb-12 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Что нового</h1>
                <p className="text-muted-foreground text-sm mt-1">Обновления ПРАКТИКИ — в кабинете и в приложении</p>
            </div>

            <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border hidden md:block" />

                <div className="space-y-6">
                    {changelog.map((entry, i) => {
                        const Icon = entry.icon;
                        return (
                            <div key={i} className="relative md:pl-14">
                                {/* Timeline dot */}
                                <div className={`hidden md:flex absolute left-0 w-10 h-10 rounded-xl ${entry.color} items-center justify-center z-10`}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                <div className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-card hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`md:hidden w-10 h-10 rounded-xl ${entry.color} flex items-center justify-center`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-foreground">{entry.title}</h2>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-semibold bg-muted px-2 py-0.5 rounded-md">v{entry.version}</span>
                                                <span>•</span>
                                                <span>{entry.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ul className="space-y-2.5">
                                        {entry.items.map((item, j) => (
                                            /* Вместо эмодзи — точка: эмодзи у каждой строки
                                               спорили с иконкой записи и набирались вразнобой
                                               (щит, лупа, флажок), не добавляя смысла. */
                                            <li key={j} className="flex items-start gap-2.5 text-sm text-foreground/90 leading-relaxed">
                                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-[7px] flex-shrink-0" />
                                                <span className="flex-1 font-medium">{item.text}</span>
                                                {item.tag && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tagStyle[item.tag]}`}>
                                                        {tagLabel[item.tag]}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
