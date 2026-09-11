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
import type { LegalLinks } from '@/lib/auth/simpasid-legal';

// Адреса документов приходят с сервера: экран их не выдумывает.
const LINKS: LegalLinks = { terms: 'https://auth.cmpas.ru/legal/terms/0.9', privacy: 'https://auth.cmpas.ru/legal/privacy/0.9', practiceTerms: 'https://auth.cmpas.ru/legal/practice-terms/0.9' };
const form = (enabled: boolean, links: LegalLinks = LINKS) => <AuthForm simpasIdEnabled={enabled} legalLinks={links} />;

// Кнопки стали кружками со знаком и подписи на себе больше не носят.
// Поэтому ищем их ПО ДОСТУПНОМУ ИМЕНИ, а не по видимому тексту, — и это не
// обход проверки, а усиление: кружок без доступного имени для человека с
// озвучкой экрана называется «кнопка» и ничего не значит. Раньше подпись
// была видна и проверять её отдельно было нечего; теперь есть.
const YANDEX = /Войти через Яндекс/;
const VK = /Войти через VK/;
const button = (name: RegExp) => screen.getByRole('button', { name });

describe('кнопки входа через провайдеров', () => {
    beforeEach(() => {
        signIn.mockReset();
        window.history.replaceState({}, '', '/auth');
    });
    afterEach(cleanup);

    // ЕДИНЫЙ ВХОД НЕ НАСТРОЕН — КРУЖКОВ НЕТ ВОВСЕ.
    //
    // Оба провайдера ходят через СИМПАС. Без настроенного единого входа за
    // кружком нет ничего, а кружок, за которым ничего нет, — обещание,
    // которое некому исполнить. Остаётся вход по почте.
    it('единый вход не настроен — ни одного кружка провайдера', () => {
        render(form(false));
        expect(screen.queryByRole('button', { name: YANDEX })).toBeNull();
        expect(screen.queryByRole('button', { name: VK })).toBeNull();
        expect(screen.getByPlaceholderText('Введите email')).toBeTruthy();
    });

    it('настроен — ровно два кружка, Яндекс и VK', () => {
        render(form(true));
        expect(button(YANDEX)).toBeTruthy();
        expect(button(VK)).toBeTruthy();
        // Отдельного кружка СИМПАС нет: он вёл ровно туда же, только без
        // подсказки провайдера.
        expect(screen.queryByRole('button', { name: /СИМПАС/ })).toBeNull();
    });

    // ГЛАВНАЯ ПРОВЕРКА ФАЙЛА.
    //
    // Раньше кнопка Яндекса звала signIn("yandex") — наше собственное
    // приложение Яндекс ID, мимо Экосистемы. Решение учредителя от
    // 11.09.2026: личность приходит только от СИМПАС.
    it('Яндекс идёт через единый вход с подсказкой провайдера', () => {
        render(form(true));
        fireEvent.click(button(YANDEX));
        expect(signIn.mock.calls[0][0]).toBe('simpasid');
        expect(signIn.mock.calls[0][2]).toEqual({ provider: 'yandex' });
    });

    it('VK идёт через единый вход с подсказкой провайдера', () => {
        render(form(true));
        fireEvent.click(button(VK));
        expect(signIn.mock.calls[0][0]).toBe('simpasid');
        expect(signIn.mock.calls[0][2]).toEqual({ provider: 'vkid' });
    });

    it('адрес возврата сохраняется — иначе сценарий с ботом сломается', () => {
        window.history.replaceState({}, '', '/auth?next=%2Fdiary%2Fclients%3Fattest%3D1');
        render(form(true));
        fireEvent.click(button(YANDEX));
        expect(signIn.mock.calls[0][1]).toEqual({ callbackUrl: '/diary/clients?attest=1' });
    });

    it('чужой адрес в next не уводит наружу', () => {
        window.history.replaceState({}, '', '/auth?next=https%3A%2F%2Fevil.example.com');
        render(form(true));
        fireEvent.click(button(VK));
        const target = (signIn.mock.calls[0][1] as { callbackUrl: string }).callbackUrl;
        expect(target.startsWith('/')).toBe(true);
        expect(target).not.toContain('evil.example.com');
    });

    it('у кружков есть доступное имя — иначе для озвучки это просто «кнопка»', () => {
        render(form(true));
        expect(button(YANDEX).getAttribute('aria-label')).toBe('Войти через Яндекс');
        expect(button(VK).getAttribute('aria-label')).toBe('Войти через VK');
    });
});

describe('юридическая строка', () => {
    afterEach(cleanup);

    // Документов три, и третий — про продукт, которым человек пользуется.
    it('ведёт на три документа в консент-центре, а не на наши копии', () => {
        render(form(true));
        const href = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
        expect(href(/Пользовательское соглашение/)).toBe(LINKS.terms);
        expect(href(/Политика конфиденциальности/)).toBe(LINKS.privacy);
        expect(href(/Особые условия ПРАКТИКИ/)).toBe(LINKS.practiceTerms);
    });

    // Выдуманного адреса тут быть не может: нет документа — нет ссылки.
    it('Особых условий нет в реестре — ссылки нет, остальные на месте', () => {
        render(form(true, { ...LINKS, practiceTerms: null }));
        expect(screen.queryByRole('link', { name: /Особые условия/ })).toBeNull();
        expect(screen.getByRole('link', { name: /Пользовательское соглашение/ })).toBeTruthy();
    });
});
