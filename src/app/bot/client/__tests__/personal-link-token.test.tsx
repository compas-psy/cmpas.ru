// @vitest-environment jsdom
//
// ПРАКТИКА · CJM записи, ТЗ 29.08.2026 §4.3, экран 7 «Мои встречи»:
// /bot/client узнавал клиента только внутри Telegram WebApp
// (window.Telegram.WebApp.initDataUnsafe) или по localStorage на этом же
// устройстве — открытие по личной ссылке из Max (или любого другого браузера
// без localStorage) не читало `?c=<token>` вовсе и упиралось в тупиковое
// сообщение (в проде — фактически в бесконечный спиннер, см. комментарий в
// page.tsx). Эти тесты проверяют: (1) валидный токен сам по себе, без
// Telegram и localStorage, доводит до списка встреч конкретного клиента;
// (2) отсутствие всех трёх источников — до тупикового сообщения, а не до
// вечного спиннера; (3) вкладки «Предстоящие»/«Прошедшие» показывают разные
// списки сессий одного и того же ответа API.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
    useSearchParams: () => nav.params,
}));

const actions = vi.hoisted(() => ({
    resolveClientLinkParam: vi.fn(),
}));
vi.mock('@/app/bot/actions', () => actions);

vi.mock('@/components/psidairy/CancelSessionDialog', () => ({
    CancelSessionDialog: () => null,
}));

import ClientPage from '../page';

function mockFetchJson(data: unknown) {
    (global as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => data,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom по умолчанию не даёт window.Telegram — сценарий "открыто из Max
    // или из обычного браузера по личной ссылке".
    delete (window as any).Telegram;
    nav.params = new URLSearchParams();
});

describe('открытие /bot/client?c=<token> без Telegram и без localStorage (§4.3)', () => {
    it('валидный токен резолвится через resolvePersonalClientToken и показывает встречи клиента', async () => {
        nav.params = new URLSearchParams({ c: 'st1_validtoken' });
        actions.resolveClientLinkParam.mockResolvedValue({ clientId: 'client-42', legacy: false });
        mockFetchJson({
            upcoming: [{
                id: 'u1', clientId: 'client-42', date: '2026-09-01T00:00:00.000Z', time: '10:00',
                format: 'online', psychologistId: 'psy-1', psychologistName: 'Анна Волкова', address: null,
            }],
            past: [],
        });

        render(<ClientPage />);

        await waitFor(() => expect(actions.resolveClientLinkParam).toHaveBeenCalledWith('st1_validtoken'));
        await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
        const fetchedUrl = ((global as any).fetch as any).mock.calls[0][0] as string;
        expect(fetchedUrl).toContain('clientId=client-42');

        expect(await screen.findByText(/Анна Волкова/)).toBeInTheDocument();
        expect(screen.queryByText(/откройте приложение через бота/)).not.toBeInTheDocument();
    });

    it('без токена, Telegram и localStorage — тупиковое сообщение, а не бесконечный спиннер', async () => {
        actions.resolveClientLinkParam.mockResolvedValue(null);

        render(<ClientPage />);

        expect(await screen.findByText(/откройте приложение через бота/)).toBeInTheDocument();
    });

    it('невалидный/просроченный токен без Telegram и localStorage — тоже тупиковое сообщение', async () => {
        nav.params = new URLSearchParams({ c: 'st1_expiredortampered' });
        actions.resolveClientLinkParam.mockResolvedValue(null);

        render(<ClientPage />);

        expect(await screen.findByText(/откройте приложение через бота/)).toBeInTheDocument();
    });
});

describe('вкладки «Предстоящие» / «Прошедшие» (§4.3, экран 7)', () => {
    it('показывают разные списки сессий одного клиента', async () => {
        nav.params = new URLSearchParams({ c: 'st1_validtoken' });
        actions.resolveClientLinkParam.mockResolvedValue({ clientId: 'client-42', legacy: false });
        mockFetchJson({
            upcoming: [{
                id: 'u1', clientId: 'client-42', date: '2026-09-05T00:00:00.000Z', time: '11:00',
                format: 'online', psychologistId: 'psy-1', psychologistName: 'Анна Волкова', address: null,
            }],
            past: [{
                id: 'p1', clientId: 'client-42', date: '2026-08-01T00:00:00.000Z', time: '09:00',
                format: 'online', psychologistId: 'psy-1', psychologistName: 'Игорь Петров', address: null,
            }],
        });

        render(<ClientPage />);

        expect(await screen.findByText(/Анна Волкова/)).toBeInTheDocument();
        expect(screen.queryByText(/Игорь Петров/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Прошедшие' }));

        expect(await screen.findByText(/Игорь Петров/)).toBeInTheDocument();
        expect(screen.queryByText(/Анна Волкова/)).not.toBeInTheDocument();
    });
});
