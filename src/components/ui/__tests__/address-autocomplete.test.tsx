// @vitest-environment jsdom
//
// Задача 19: у пустых подсказок два РАЗНЫХ смысла, и человек должен их
// различать. «Ничего не нашли» — адрес редкий, дописывайте руками.
// «Подсказки временно недоступны» — сломана интеграция. Если показывать в
// обоих случаях одно и то же (а раньше — вообще ничего), поломка живёт
// молча.
//
// И в любом случае поле остаётся обычным текстовым: подсказки не имеют права
// ни блокировать ввод, ни стирать уже набранный адрес.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { useState } from 'react';
import AddressAutocomplete from '../address-autocomplete';

const UNAVAILABLE = 'Подсказки временно недоступны. Введите адрес вручную.';
const NOTHING_FOUND = 'Ничего не нашли — адрес можно ввести вручную.';

/** Обёртка с состоянием: так же, как компонент используется в настройках. */
function Host({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <AddressAutocomplete value={value} onChange={setValue} placeholder="Адрес кабинета" />;
}

function respond(status: number, body: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

function type(text: string) {
    fireEvent.change(screen.getByPlaceholderText('Адрес кабинета'), { target: { value: text } });
    // Дебаунс поля — 300 мс.
    act(() => { vi.advanceTimersByTime(300); });
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
});

describe('провайдер недоступен — человек об этом узнаёт', () => {
    it.each([
        ['502 PROVIDER_UNAVAILABLE', 502, { error: 'PROVIDER_UNAVAILABLE' }],
        ['503 NOT_CONFIGURED', 503, { error: 'NOT_CONFIGURED' }],
        ['504 PROVIDER_UNAVAILABLE', 504, { error: 'PROVIDER_UNAVAILABLE' }],
        ['429 RATE_LIMITED', 429, { error: 'RATE_LIMITED' }],
    ])('%s показывает «подсказки временно недоступны»', async (_name, status, body) => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(status, body)));
        render(<Host />);

        type('Яузская');

        expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
        expect(screen.queryByText(NOTHING_FOUND)).not.toBeInTheDocument();
    });

    it('сеть не дошла — то же сообщение, а не тишина', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        render(<Host />);

        type('Яузская');

        expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    });

    it('набранный адрес остаётся в поле и поле остаётся редактируемым', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(502, { error: 'PROVIDER_UNAVAILABLE' })));
        render(<Host />);

        type('ул. Яузская, 5');
        await screen.findByText(UNAVAILABLE);

        const input = screen.getByPlaceholderText('Адрес кабинета') as HTMLInputElement;
        expect(input.value).toBe('ул. Яузская, 5');
        expect(input).not.toBeDisabled();
        expect(input).not.toHaveAttribute('readonly');

        // Дописать руками можно прямо поверх недоступных подсказок.
        fireEvent.change(input, { target: { value: 'ул. Яузская, 5, каб. 12' } });
        expect((screen.getByPlaceholderText('Адрес кабинета') as HTMLInputElement).value).toBe('ул. Яузская, 5, каб. 12');
    });
});

describe('ничего не нашли — это другое состояние', () => {
    it('успешный поиск с нулём результатов говорит именно об этом', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(200, { suggestions: [] })));
        render(<Host />);

        type('Такогоадресанет');

        expect(await screen.findByText(NOTHING_FOUND)).toBeInTheDocument();
        expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    });

    it('адрес при этом никуда не девается и остаётся редактируемым', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(200, { suggestions: [] })));
        render(<Host />);

        type('Такогоадресанет');
        await screen.findByText(NOTHING_FOUND);

        const input = screen.getByPlaceholderText('Адрес кабинета') as HTMLInputElement;
        expect(input.value).toBe('Такогоадресанет');
        expect(input).not.toBeDisabled();
    });

    it('нашли — показываются подсказки, а не сообщения', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(200, {
            suggestions: [{ value: 'Москва, ул. Яузская, 5', data: {} }],
        })));
        render(<Host />);

        type('Яузская');

        expect(await screen.findByText('Москва, ул. Яузская, 5')).toBeInTheDocument();
        expect(screen.queryByText(NOTHING_FOUND)).not.toBeInTheDocument();
        expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    });

    it('выбор подсказки подставляет адрес и убирает список', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(200, {
            suggestions: [{ value: 'Москва, ул. Яузская, 5', data: {} }],
        })));
        render(<Host />);

        type('Яузская');
        fireEvent.click(await screen.findByText('Москва, ул. Яузская, 5'));

        expect((screen.getByPlaceholderText('Адрес кабинета') as HTMLInputElement).value).toBe('Москва, ул. Яузская, 5');
        expect(screen.queryByText('Москва, ул. Яузская, 5')).not.toBeInTheDocument();
    });
});

describe('негодный запрос не пугает человека', () => {
    it('400 не показывает сообщение о поломке — это наша недоработка, а не сбой сервиса', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => respond(400, { error: 'INVALID_QUERY' })));
        render(<Host />);

        type('Яузская');

        await waitFor(() => expect(screen.queryByTestId('suggest-notice')).not.toBeInTheDocument());
        expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    });

    it('короткий ввод вообще не ходит на сервер', () => {
        const fetchMock = vi.fn(async () => respond(200, { suggestions: [] }));
        vi.stubGlobal('fetch', fetchMock);
        render(<Host />);

        type('Яу');

        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('устаревший ответ не затирает свежий', () => {
    it('запрос предыдущего ввода отменяется', async () => {
        const seen: Array<{ query: string; aborted: () => boolean }> = [];
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            const query = JSON.parse(String(init.body)).query;
            seen.push({ query, aborted: () => Boolean(init.signal?.aborted) });
            if (query === 'Яузская') {
                // Первый ответ приходит с задержкой — после второго ввода.
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return respond(200, { suggestions: [{ value: `подсказка к «${query}»`, data: {} }] });
        }));
        render(<Host />);

        type('Яузская');
        type('Яузская, 5');

        expect(await screen.findByText('подсказка к «Яузская, 5»')).toBeInTheDocument();
        await act(async () => { vi.advanceTimersByTime(100); });

        // Ответ на устаревший запрос не подменил свежие подсказки.
        expect(screen.getByText('подсказка к «Яузская, 5»')).toBeInTheDocument();
        expect(screen.queryByText('подсказка к «Яузская»')).not.toBeInTheDocument();
        expect(seen[0].aborted()).toBe(true);
    });
});
