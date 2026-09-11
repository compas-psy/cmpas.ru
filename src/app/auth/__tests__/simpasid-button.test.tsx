// @vitest-environment jsdom
// Кнопка единого входа СИМПАС на экране входа.
//
// Проверяется ровно то, чего не проверил рецепт интеграции: провайдер в
// конфигурации даёт РАБОТАЮЩИЙ, но НЕВИДИМЫЙ способ входа. Наша страница
// входа не строит список провайдеров сама — кнопки заданы руками, — и
// правка только в src/auth.ts оставила бы человека перед экраном, где
// нажать нечего.
//
// Второе — адрес возврата. Бот на пересланный контакт отвечает ссылкой
// /diary/clients?attest=1, и без callbackUrl вход через СИМПАС молча увёл
// бы на «Сегодня». Сломалось бы это только у тех, кто вошёл новым
// способом, — то есть незаметно.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const signIn = vi.fn();
vi.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signIn(...args) }));
// Заглушка next/image: в jsdom настоящий компонент не нужен, а правило про
// <img> адресовано разметке продукта, а не подмене в тесте.
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...props} alt="" /> }));

// Знак внутри кружка — украшение: имя кнопке даёт её aria-label, а не
// картинка. Поэтому alt пустой и в проде, и здесь.
vi.mock('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import AuthForm from '../AuthForm';

// Кнопки стали кружками со знаком и подписи на себе больше не носят.
// Поэтому ищем их ПО ДОСТУПНОМУ ИМЕНИ, а не по видимому тексту, — и это не
// обход проверки, а усиление: кружок без доступного имени для человека с
// озвучкой экрана называется «кнопка» и ничего не значит. Раньше подпись
// была видна и проверять её отдельно было нечего; теперь есть.
const SIMPAS = /Войти через СИМПАС/;
const YANDEX = /Войти через Яндекс/;
const button = (name: RegExp) => screen.getByRole('button', { name });

describe('кнопка единого входа', () => {
    beforeEach(() => {
        signIn.mockReset();
        window.history.replaceState({}, '', '/auth');
    });
    afterEach(cleanup);

    it('единый вход не настроен — кнопки нет', () => {
        render(<AuthForm simpasIdEnabled={false} />);
        expect(screen.queryByRole('button', { name: SIMPAS })).toBeNull();
        // Прежние способы на месте и в прежнем порядке — этот способ
        // ДОБАВЛЯЕТСЯ, а не заменяет.
        expect(button(YANDEX)).toBeTruthy();
    });

    it('настроен — кнопка есть, и прежние способы никуда не делись', () => {
        render(<AuthForm simpasIdEnabled />);
        expect(button(SIMPAS)).toBeTruthy();
        expect(button(YANDEX)).toBeTruthy();
        expect(screen.getByPlaceholderText('Введите email')).toBeTruthy();
    });

    it('нажатие ведёт в провайдера simpasid', () => {
        render(<AuthForm simpasIdEnabled />);
        fireEvent.click(button(SIMPAS));
        expect(signIn.mock.calls[0][0]).toBe('simpasid');
    });

    it('адрес возврата сохраняется — иначе сценарий с ботом сломается', () => {
        window.history.replaceState({}, '', '/auth?next=%2Fdiary%2Fclients%3Fattest%3D1');
        render(<AuthForm simpasIdEnabled />);
        fireEvent.click(button(SIMPAS));
        expect(signIn.mock.calls[0][1]).toEqual({ callbackUrl: '/diary/clients?attest=1' });
    });

    it('у кружков есть доступное имя — иначе для озвучки это просто «кнопка»', () => {
        // Кнопка со знаком вместо подписи читается глазами мгновенно и не
        // читается вовсе без них. Имя — единственное, что делает её
        // нажимаемой для человека с озвучкой экрана.
        render(<AuthForm simpasIdEnabled />);
        expect(button(YANDEX).getAttribute('aria-label')).toBe('Войти через Яндекс');
        expect(button(SIMPAS).getAttribute('aria-label')).toBe('Войти через СИМПАС');
    });

    // Тот же строгий разбор, что у двух соседних кнопок: параметр «куда
    // вернуться» без проверки — это открытая переадресация.
    it('чужой адрес в next не уводит наружу', () => {
        window.history.replaceState({}, '', '/auth?next=https%3A%2F%2Fevil.example.com');
        render(<AuthForm simpasIdEnabled />);
        fireEvent.click(button(SIMPAS));
        const target = (signIn.mock.calls[0][1] as { callbackUrl: string }).callbackUrl;
        expect(target.startsWith('/')).toBe(true);
        expect(target).not.toContain('evil.example.com');
    });
});
