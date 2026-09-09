// @vitest-environment jsdom
//
// Кружок клиента: фотография из мессенджера, инициалы — когда её нет.
//
// Аватарки не будет у клиента без мессенджера, у клиента с закрытым фото и
// в минуты, когда мессенджер недоступен. Поэтому проверяется главное: НИ ПРИ
// КАКОМ раскладе на экране не должно оказаться пустого кружка или значка
// сломанной картинки — там должны быть инициалы, как было до правки.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientAvatar } from '../ClientAvatar';

afterEach(cleanup);

const imageOf = (container: HTMLElement) => container.querySelector('img') as HTMLImageElement;

describe('кружок клиента', () => {
    it('инициалы видны сразу, ещё до фотографии', () => {
        render(<ClientAvatar clientId="c1" initials="АС" />);
        expect(screen.getByText('АС')).not.toBeNull();
    });

    it('фотография спрашивается у нашего маршрута, а не у мессенджера напрямую', () => {
        // Прямой адрес файла Telegram содержит токен бота целиком — в
        // браузере ему делать нечего.
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" />);
        expect(imageOf(container).getAttribute('src')).toBe('/api/clients/c1/avatar');
    });

    it('фотографии нет — инициалы остаются, дыры не появляется', () => {
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" />);
        fireEvent.error(imageOf(container));
        expect(screen.getByText('АС')).not.toBeNull();
        expect(imageOf(container).className).toContain('opacity-0');
    });

    it('фотография доехала — показывается она', () => {
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" />);
        fireEvent.load(imageOf(container));
        expect(imageOf(container).className).toContain('opacity-100');
    });

    it('в списке фотографии грузятся отложенно', () => {
        // Каждый кружок — это поход нашего сервера в мессенджер. У Telegram
        // предел общий на бота: тот же, которым уходят уведомления клиентам.
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" />);
        expect(imageOf(container).getAttribute('loading')).toBe('lazy');
    });

    it('открытая карточка грузит сразу — она одна', () => {
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" lazy={false} />);
        expect(imageOf(container).getAttribute('loading')).toBe('eager');
    });

    it('сменился клиент — чужое лицо не остаётся', () => {
        // Без сброса React переиспользует тот же узел, и на карточке нового
        // клиента на мгновение висела бы фотография предыдущего.
        const { container, rerender } = render(<ClientAvatar clientId="c1" initials="АС" />);
        fireEvent.load(imageOf(container));
        expect(imageOf(container).className).toContain('opacity-100');

        rerender(<ClientAvatar clientId="c2" initials="ИМ" />);
        expect(imageOf(container).className).toContain('opacity-0');
        expect(screen.getByText('ИМ')).not.toBeNull();
    });

    it('фотография не подписывается — она не несёт смысла отдельно от имени', () => {
        const { container } = render(<ClientAvatar clientId="c1" initials="АС" />);
        expect(imageOf(container).getAttribute('alt')).toBe('');
    });
});
