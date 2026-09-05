// @vitest-environment jsdom
// Задача 24 §5: шаг «Поделиться» закрывает только состоявшееся действие.
//
// Самое лёгкое здесь — соврать: отметить шаг в момент открытия шторки. Тогда
// чек-лист покажет «сделано» человеку, который заглянул и передумал, и
// подсказка «отдайте ссылку клиенту» исчезнет, не сработав.
//
// Поэтому проверяется каждая развилка отдельно: не скопировалось — не
// считается, системный диалог отменили — не считается, QR не построился — не
// считается. Считается только успех.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const qrcode = { toDataURL: vi.fn(async () => 'data:image/png;base64,qr') };
vi.mock('qrcode', () => ({ default: qrcode }));

import { ShareSheet } from '../ShareSheet';

const URL = 'https://cmpas.ru/u/ilya';
let onShared: ReturnType<typeof vi.fn<() => void>>;

function renderSheet() {
    onShared = vi.fn<() => void>();
    render(<ShareSheet isOpen onClose={() => {}} url={URL} text="Запишитесь на сессию:" onShared={onShared} />);
}

beforeEach(() => {
    vi.clearAllMocks();
    qrcode.toDataURL.mockResolvedValue('data:image/png;base64,qr');
    // Буфер обмена по умолчанию работает.
    Object.assign(navigator, {
        clipboard: { writeText: vi.fn(async () => undefined) },
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    vi.stubGlobal('open', vi.fn());
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    // navigator.share появляется только там, где тест его ставит.
    delete (navigator as unknown as { share?: unknown }).share;
});

describe('открытие шторки', () => {
    it('само по себе шагом не является', () => {
        renderSheet();

        expect(screen.getByText('Скопировать')).toBeInTheDocument();
        expect(onShared).not.toHaveBeenCalled();
    });
});

describe('копирование', () => {
    it('успешное копирование закрывает шаг', async () => {
        renderSheet();

        fireEvent.click(screen.getByText('Скопировать'));

        await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
    });

    it('копирование не удалось — шаг не закрывается', async () => {
        renderSheet();
        (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('нет доступа'));
        // Запасной путь через execCommand тоже недоступен.
        Object.defineProperty(document, 'execCommand', { value: () => { throw new Error('нет'); }, configurable: true });

        fireEvent.click(screen.getByText('Скопировать'));

        await waitFor(() => expect(screen.getByText('Скопировать')).toBeInTheDocument());
        expect(onShared).not.toHaveBeenCalled();
    });
});

describe('системный шеринг', () => {
    it('система приняла — шаг закрывается', async () => {
        Object.assign(navigator, { share: vi.fn(async () => undefined) });
        renderSheet();

        fireEvent.click(screen.getByText('Max'));

        await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
    });

    it('человек закрыл системный диалог — шаг не закрывается', async () => {
        Object.assign(navigator, { share: vi.fn(async () => { throw new Error('AbortError'); }) });
        renderSheet();

        fireEvent.click(screen.getByText('Max'));

        await waitFor(() => expect(navigator.share).toHaveBeenCalled());
        expect(onShared).not.toHaveBeenCalled();
    });
});

describe('QR', () => {
    it('построился и показан — шаг закрывается', async () => {
        renderSheet();

        fireEvent.click(screen.getByText('Показать QR'));

        await waitFor(() => expect(onShared).toHaveBeenCalledTimes(1));
        expect(screen.getByAltText('QR-код ссылки для записи')).toBeInTheDocument();
    });

    it('не построился — шаг не закрывается', async () => {
        qrcode.toDataURL.mockRejectedValue(new Error('не смогли'));
        renderSheet();

        fireEvent.click(screen.getByText('Показать QR'));

        await waitFor(() => expect(qrcode.toDataURL).toHaveBeenCalled());
        expect(onShared).not.toHaveBeenCalled();
        expect(screen.queryByAltText('QR-код ссылки для записи')).not.toBeInTheDocument();
    });
});

describe('переход в мессенджер', () => {
    it('Telegram открывается с той же постоянной ссылкой и считается действием', () => {
        renderSheet();

        fireEvent.click(screen.getByText('Telegram'));

        expect(window.open).toHaveBeenCalled();
        const opened = (window.open as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
        expect(decodeURIComponent(opened)).toContain(URL);
        expect(onShared).toHaveBeenCalledTimes(1);
    });
});
