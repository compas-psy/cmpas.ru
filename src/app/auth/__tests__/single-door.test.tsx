// @vitest-environment jsdom
// Единый вход как дверь по умолчанию — и её выключатель.
//
// Решение учредителя было: экран с тремя кнопками путал, поэтому
// неаутентифицированного уводим сразу в единый вход. В день выкладки СИМПАС
// перестал пускать через Яндекс, и дверь по решению учредителя выключена до
// починки на их стороне.
//
// Проверяется здесь не «редирект случился», а то, что решает судьбу живых
// людей:
//
//   1. Сегодняшнее состояние: дверь выключена, экран прежний, с кнопками.
//   2. Включённая дверь работает — чтобы возвращать её было чем проверить.
//   3. Запасная дверь существует и открывается. Пятеро из шестнадцати живых
//      людей входят только магической ссылкой на почту; без неё включённая
//      дверь запирает их снаружи собственной практики.
//   4. «Куда вернуться» не теряется ни на одной из двух дверей.
//   5. Пока ключ единого входа не выдан, не уводим никогда — иначе правка
//      выключила бы вход на стенде и у разработчика.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { shouldSendToSimpasId, EMAIL_DOOR, SIMPASID_IS_DEFAULT_DOOR } from '@/lib/auth/simpasid';

const signIn = vi.fn((provider: string, options?: Record<string, unknown>) => Promise.resolve({ provider, options }));
vi.mock('next-auth/react', () => ({
    signIn: (provider: string, options?: Record<string, unknown>) => signIn(provider, options),
}));
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...props} alt="" /> }));
vi.mock('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import SimpasIdDoor from '../SimpasIdDoor';

describe('правило двери', () => {
    // Дверь по умолчанию сейчас ВЫКЛЮЧЕНА: СИМПАС не пускает через Яндекс,
    // и уводить туда каждого — значит показывать чужую страницу отказа
    // пятнадцати специалистам, которые этим входом никогда не пользовались.
    // Проверки держат оба состояния, чтобы возвращать дверь было чем
    // проверить, а не на глаз.

    it('сейчас дверь по умолчанию выключена — экран с кнопками', () => {
        expect(SIMPASID_IS_DEFAULT_DOOR).toBe(false);
        expect(shouldSendToSimpasId({ configured: true })).toBe(false);
        expect(shouldSendToSimpasId({ configured: true, door: null })).toBe(false);
    });

    it('включённая дверь ведёт в единый вход', () => {
        expect(shouldSendToSimpasId({ configured: true, isDefaultDoor: true })).toBe(true);
    });

    it('ключ не выдан — не уводим, даже при включённой двери', () => {
        // Иначе правка выключила бы вход везде, где ключа нет: на стенде и
        // на машине разработчика.
        expect(shouldSendToSimpasId({ configured: false, isDefaultDoor: true })).toBe(false);
        expect(shouldSendToSimpasId({ configured: false })).toBe(false);
    });

    it('запасная дверь открывается явным ?door=email', () => {
        expect(shouldSendToSimpasId({ configured: true, door: EMAIL_DOOR, isDefaultDoor: true })).toBe(false);
    });

    it('чужое значение door запасную дверь не открывает', () => {
        // Иначе любая опечатка в адресе возвращала бы старый экран, и
        // «дверь по умолчанию» держалась бы на честном слове.
        expect(shouldSendToSimpasId({ configured: true, door: 'почта', isDefaultDoor: true })).toBe(true);
        expect(shouldSendToSimpasId({ configured: true, door: '', isDefaultDoor: true })).toBe(true);
    });
});

describe('экран увода в единый вход', () => {
    beforeEach(() => signIn.mockClear());
    afterEach(cleanup);

    it('уводит в единый вход сам, без нажатия', () => {
        render(<SimpasIdDoor returnPath="/diary" emailDoorHref="/auth?door=email" />);
        expect(signIn).toHaveBeenCalledWith('simpasid', { callbackUrl: '/diary' });
    });

    it('уводит туда, куда человек шёл — это путь бота с аттестацией', () => {
        render(
            <SimpasIdDoor
                returnPath="/diary/clients?attest=1"
                emailDoorHref="/auth?door=email&next=%2Fdiary%2Fclients%3Fattest%3D1"
            />,
        );
        expect(signIn).toHaveBeenCalledWith('simpasid', { callbackUrl: '/diary/clients?attest=1' });
    });

    it('на экране есть выход на вход по почте', () => {
        render(<SimpasIdDoor returnPath="/diary" emailDoorHref="/auth?door=email" />);
        const link = screen.getByText('Войти по почте').closest('a');
        expect(link?.getAttribute('href')).toContain(`door=${EMAIL_DOOR}`);
    });
});

// Сама страница. Пока дверь выключена, она обязана показывать форму со
// всеми кнопками — тот же экран, что был до правки.
describe('страница входа', () => {
    const render = async (params: { door?: string; next?: string }) => {
        process.env.SIMPASID_ISSUER = 'https://auth.example';
        process.env.SIMPASID_CLIENT_ID = 'practice-web';
        process.env.SIMPASID_CLIENT_SECRET = 'ключ';
        const { default: AuthPage } = await import('../page');
        return await AuthPage({ searchParams: Promise.resolve(params) }) as {
            props: Record<string, unknown>;
        };
    };

    it('показывает форму с кнопками, а не увод', async () => {
        const element = await render({});
        expect(element.props.simpasIdEnabled).toBe(true);
        expect(element.props.returnPath).toBeUndefined();
    });

    it('явная запасная дверь тоже показывает форму', async () => {
        const element = await render({ door: EMAIL_DOOR });
        expect(element.props.simpasIdEnabled).toBe(true);
    });
});
