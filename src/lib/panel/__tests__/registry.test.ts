/**
 * Разбор `analytics/schema/events.yaml` для панели (E5 — проверка, не
 * сломал ли E1 чтение реестра панелью). E1 сделал `product` у
 * consent_updated/identity_linked списком в одну строку
 * (`product: [practice, zapiski, moments]`); ручной построчный парсер
 * registry.ts до этой правки понимал только одиночное значение и молча
 * подставлял 'unknown' для обоих событий — не ломало панель напрямую (её
 * `product` сейчас нигде не рендерится), но искажало данные q_event_silence.
 */

import { describe, expect, it } from 'vitest';
import { readEventRegistry, resetRegistryCache } from '../queries/registry';

describe('readEventRegistry: многопродуктовые события (E1/E5)', () => {
    it('consent_updated получает читаемый список продуктов, а не "unknown"', () => {
        resetRegistryCache();
        const registry = readEventRegistry();
        expect(registry.get('consent_updated')?.product).toBe('practice, zapiski, moments');
    });

    it('identity_linked получает тот же список продуктов', () => {
        resetRegistryCache();
        const registry = readEventRegistry();
        expect(registry.get('identity_linked')?.product).toBe('practice, zapiski, moments');
    });

    it('однопродуктовое событие по-прежнему разбирается как одно значение', () => {
        resetRegistryCache();
        const registry = readEventRegistry();
        expect(registry.get('payment_succeeded')?.product).toBe('practice');
        expect(registry.get('note_saved')?.product).toBe('zapiski');
        expect(registry.get('practice_started')?.product).toBe('moments');
    });
});
