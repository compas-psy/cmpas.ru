// @vitest-environment jsdom
// Единый вход как дверь по умолчанию.
//
// Решение учредителя: экран с тремя кнопками путал — Яндекс живёт И внутри
// СИМПАС, И отдельной кнопкой рядом, а слово «СИМПАС» человеку, пришедшему
// вести практику, ничего не говорит. Поэтому неаутентифицированного уводим
// сразу в единый вход.
//
// Проверяется здесь не «редирект случился», а ЦЕНА этого решения:
//
//   1. Запасная дверь существует и открывается. Пятеро из шестнадцати живых
//      людей входят только магической ссылкой на почту — без запасной двери
//      правка запирает их снаружи собственной практики.
//   2. «Куда вернуться» не теряется ни на одной из двух дверей.
//   3. Пока ключ единого входа не выдан, экран остаётся прежним — иначе
//      правка выключила бы вход на любом окружении без ключа, включая стенд.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { shouldSendToSimpasId, EMAIL_DOOR } from '@/lib/auth/simpasid';

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
    it('ключ не выдан — экран прежний, никакого увода', () => {
        // Без этого правка выключила бы вход везде, где ключа нет.
        expect(shouldSendToSimpasId({ configured: false })).toBe(false);
        expect(shouldSendToSimpasId({ configured: false, door: EMAIL_DOOR })).toBe(false);
    });

    it('ключ выдан — дверь по умолчанию ведёт в единый вход', () => {
        expect(shouldSendToSimpasId({ configured: true })).toBe(true);
        expect(shouldSendToSimpasId({ configured: true, door: null })).toBe(true);
    });

    it('запасная дверь открывается явным ?door=email', () => {
        expect(shouldSendToSimpasId({ configured: true, door: EMAIL_DOOR })).toBe(false);
    });

    it('чужое значение door запасную дверь не открывает', () => {
        // Иначе любая опечатка в адресе возвращала бы старый экран, и
        // «дверь по умолчанию» держалась бы на честном слове.
        expect(shouldSendToSimpasId({ configured: true, door: 'почта' })).toBe(true);
        expect(shouldSendToSimpasId({ configured: true, door: '' })).toBe(true);
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

// Сама страница: что она передаёт двери. Разбор возврата живёт здесь, на
// сервере, и именно здесь он может потеряться незаметно — компонент просто
// покажет то, что ему дали.
describe('страница входа собирает обе двери', () => {
    const render = async (params: { door?: string; next?: string }) => {
        process.env.SIMPASID_ISSUER = 'https://auth.example';
        process.env.SIMPASID_CLIENT_ID = 'practice-web';
        process.env.SIMPASID_CLIENT_SECRET = 'ключ';
        const { default: AuthPage } = await import('../page');
        return await AuthPage({ searchParams: Promise.resolve(params) }) as {
            props: Record<string, unknown>;
        };
    };

    it('без параметров ведёт в единый вход с возвратом по умолчанию', async () => {
        const element = await render({});
        expect(element.props.returnPath).toBe('/diary');
        expect(String(element.props.emailDoorHref)).toContain(`door=${EMAIL_DOOR}`);
    });

    it('возврат бота доезжает до обеих дверей', async () => {
        const element = await render({ next: '/diary/clients?attest=1' });
        expect(element.props.returnPath).toBe('/diary/clients?attest=1');
        const href = String(element.props.emailDoorHref);
        expect(href).toContain(`door=${EMAIL_DOOR}`);
        expect(href).toContain('next=');
    });

    it('чужой адрес возврата не принимается', async () => {
        // Открытая переадресация: без строгого разбора «войдите здесь» увело
        // бы человека с кодом авторизации на чужой домен.
        const element = await render({ next: 'https://evil.example.com' });
        expect(element.props.returnPath).toBe('/diary');
    });

    it('запасная дверь показывает форму, а не уводит', async () => {
        const element = await render({ door: EMAIL_DOOR });
        expect(element.props.simpasIdEnabled).toBe(true);
        expect(element.props.returnPath).toBeUndefined();
    });
});
