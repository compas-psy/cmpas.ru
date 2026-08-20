/**
 * Вычистка свободного текста (ТЗ §8).
 *
 * Тест появился после разбора собственного диффа: `DeployLog.errorNote`
 * читался без `select` и печатался как есть, а `guard` клал на экран сырое
 * сообщение Prisma. И то и другое — свободный текст, в котором бывают пути.
 */

import { describe, expect, it, vi } from 'vitest';
import { redact, REDACTED } from '../redact';
import { guard } from '../types';

describe('вычистка свободного текста', () => {
    it('убирает пути в стиле unix', () => {
        const out = redact('миграция /var/lib/postgresql/data/migrations/001_init.sql не применилась');
        expect(out).not.toContain('/var/lib');
        expect(out).toContain(REDACTED);
        expect(out).toContain('не применилась');
    });

    it('убирает пути в стиле windows', () => {
        expect(redact('не найден C:\\deploy\\secrets\\key.pem')).not.toContain('C:\\deploy');
    });

    it('убирает адреса почты и телефоны', () => {
        expect(redact('уведомление ушло на admin@cmpas.ru')).not.toContain('@cmpas.ru');
        expect(redact('звонок на +7 999 123 45 67 не прошёл')).not.toContain('999');
    });

    it('обрезает длинный дамп, а не печатает его целиком', () => {
        const long = 'ошибка '.repeat(200);
        const out = redact(long);
        expect(out!.length).toBeLessThanOrEqual(201);
        expect(out!.endsWith('…')).toBe(true);
    });

    it('пустое и отсутствующее значение остаются пустыми', () => {
        expect(redact(null)).toBeNull();
        expect(redact(undefined)).toBeNull();
        expect(redact('   ')).toBeNull();
    });

    it('обычный текст не портится', () => {
        expect(redact('Две миграции не применены')).toBe('Две миграции не применены');
    });

    it('причина упавшего запроса выходит на экран вычищённой', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const block = await guard('q_demo', async () => {
            throw new Error('ENOENT: /home/user/secrets/db.env, обращение от admin@cmpas.ru');
        });
        spy.mockRestore();

        expect(block.state).toBe('broken');
        expect(block.reason).not.toContain('/home/user');
        expect(block.reason).not.toContain('admin@cmpas.ru');
        expect(block.reason).toContain('запрос падает');
    });
});
