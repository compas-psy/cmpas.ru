// @vitest-environment jsdom
// Витрина подписки называет состояние, а не пересказывает поле.
//
// Дефект, ради которого написан файл: экран ветвился по самому наличию
// даты окончания. Подписка кончилась в мае — в сентябре человек видел
// крупное «Подписка активна», а мелкой строкой под ним дату из прошлого.
// Крупное читают, мелкое сверяют с календарём редко.
//
// Сервер при этом считал правильно и знал ответ — он просто не отдавал
// его наружу. Поэтому проверяется именно связка: экран верит выводу
// сервера (subscriptionActive), а не делает свой из даты.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...props} alt="" /> }));

import BillingPage from '../page';

type State = Record<string, unknown>;

function serve(state: State) {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => state })));
}

describe('витрина подписки', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/billing');
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('оплачена и не кончилась — «активна» с датой', async () => {
        serve({
            daysLeft: 20, isExpired: false, isForever: false,
            subscriptionActive: true,
            subscriptionEndsAt: '2027-05-05T00:00:00.000Z', subscriptionPlan: 'practice',
        });
        render(<BillingPage />);
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Подписка активна' })).toBeTruthy());
        expect(screen.getByText(/действует до 05\.05\.2027/)).toBeTruthy();
    });

    // ГЛАВНАЯ ПРОВЕРКА ФАЙЛА.
    it('дата в прошлом — «закончилась», а не «активна»', async () => {
        serve({
            daysLeft: 0, isExpired: true, isForever: false,
            subscriptionActive: false,
            subscriptionEndsAt: '2026-05-05T00:00:00.000Z', subscriptionPlan: 'practice',
        });
        render(<BillingPage />);
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Подписка закончилась' })).toBeTruthy());
        expect(screen.queryByText('Подписка активна')).toBeNull();
        // Число называется вслух: иначе «закончилась» — упрёк без объяснения.
        expect(screen.getByText(/закончилась 05\.05\.2026/)).toBeTruthy();
    });

    it('бессрочный доступ ничего не продаёт', async () => {
        serve({
            daysLeft: null, isExpired: false, isForever: true,
            subscriptionActive: false, subscriptionEndsAt: null, subscriptionPlan: null,
        });
        render(<BillingPage />);
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Бесплатный доступ' })).toBeTruthy());
        expect(screen.queryByRole('button', { name: /Оформить/ })).toBeNull();
    });

    it('тариф на витрине один — «Практика+» не показывается', async () => {
        serve({
            daysLeft: 14, isExpired: false, isForever: false,
            subscriptionActive: false, subscriptionEndsAt: null, subscriptionPlan: null,
        });
        render(<BillingPage />);
        await waitFor(() => expect(screen.getByRole('button', { name: /Оформить/ })).toBeTruthy());
        expect(screen.queryByText('Практика+')).toBeNull();
        expect(screen.queryByText('Скоро')).toBeNull();
    });

    // Перечисление чужих брендов на витрине стареет от каждого нового канала
    // и рекламирует не нас.
    it('мессенджеры названы обобщённо', async () => {
        serve({
            daysLeft: 14, isExpired: false, isForever: false,
            subscriptionActive: false, subscriptionEndsAt: null, subscriptionPlan: null,
        });
        render(<BillingPage />);
        await waitFor(() => expect(screen.getByText(/Боты в популярных мессенджерах/)).toBeTruthy());
        expect(screen.queryByText(/Telegram/)).toBeNull();
        expect(screen.queryByText(/Google/)).toBeNull();
        expect(screen.queryByText(/Умные заметки/)).toBeNull();
    });
});
