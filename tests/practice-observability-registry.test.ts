// Задача 25 §2, §13: реестр событий ПРАКТИКИ как запрет, а не как пожелание.
//
// «Не отправляйте PII» — это не правило, если его стережёт только внимание
// автора. Здесь оно стережётся формой самого реестра: у каждого строкового
// prop перечислены допустимые значения, у каждого числового — диапазон, и
// произвольной строки нет ни в одном из десяти событий. Значит имя клиента
// физически некуда положить: не только под своим именем, но и спрятанным
// внутрь source или error_code.

import { describe, it, expect } from 'vitest';
import { loadRegistry, eventProducts, validateEvent } from '@/lib/analytics/schema';
import { forbiddenPropWord } from './fixtures/analytics-capture';

const registry = loadRegistry();

/**
 * Десять событий Задачи 25 — те, что несут приставку practice_ И принадлежат
 * продукту practice.
 *
 * Обе половины условия нужны. Продукт practice богат событиями с прошлых
 * задач (payment_*, session_*, client_*) — у них свои контракты, и эта задача
 * их не переписывает. А practice_started и practice_finished, наоборот, носят
 * приставку, но принадлежат МОМЕНТАМ: там «практика» значит медитацию.
 */
const practiceEvents = Object.entries(registry.events)
    .filter(([name, def]) => name.startsWith('practice_') && eventProducts(def).includes('practice'));

const TEN = [
    'practice_migration_started',
    'practice_migration_previewed',
    'practice_migration_committed',
    'practice_migration_failed',
    'practice_booking_link_shared',
    'practice_booking_attempted',
    'practice_booking_succeeded',
    'practice_booking_conflict',
    'practice_attention_action_completed',
    'practice_onboarding_completed',
];

/**
 * События, добавленные ПОСЛЕ Задачи 25.
 *
 * Список Задачи 25 намеренно оставлен собой: «те самые десять» — это её
 * набор, и размывать его дописыванием сюда чужого нельзя. Но и запрещать
 * навсегда любые новые события этот сторож не должен — он стережёт не
 * количество, а дисциплину: у каждого строкового prop перечислены
 * значения, произвольной строки нет нигде, имена props без человеческого
 * смысла. Три проверки ниже применяются ко всем событиям списка, включая
 * добавленные, — то есть новое событие проходит ровно тот же досмотр.
 *
 * Поэтому добавление сюда — осознанный шаг с названной причиной, а не
 * молчаливое расширение.
 */
const ADDED_LATER = [
    // Заведение клиента по контакту, пересланному боту: приживается ли
    // путь и на чём спотыкается. Оба prop — узкие перечисления.
    'practice_client_intake_contact',
];

const EXPECTED = [...TEN, ...ADDED_LATER];

function raw(event: string, props: Record<string, unknown>) {
    return { event, ts: new Date().toISOString(), product: 'practice', account_id: 'psy-1', props, schema_version: 1 };
}

describe('реестр наблюдаемости ПРАКТИКИ', () => {
    it('состав событий известен поимённо: ни одного лишнего, ни одного пропавшего', () => {
        expect(practiceEvents.map(([name]) => name).sort()).toEqual([...EXPECTED].sort());
    });

    it('десять событий Задачи 25 никуда не делись', () => {
        const present = practiceEvents.map(([name]) => name);
        for (const name of TEN) expect(present, name).toContain(name);
    });

    it('ни одного prop с человеческим смыслом в имени', () => {
        for (const [name, def] of practiceEvents) {
            for (const prop of Object.keys(def.props ?? {})) {
                // *_count — счётчик, и слово внутри него ничего не выдаёт:
                // items_count это число, а не items.
                if (prop.endsWith('_count')) continue;
                expect(forbiddenPropWord(prop), `${name}.${prop}`).toBeNull();
            }
        }
    });

    it('каждый строковый prop перечислен: произвольной строки нет нигде', () => {
        for (const [name, def] of practiceEvents) {
            for (const [prop, type] of Object.entries(def.props ?? {})) {
                if (type !== 'string') continue;
                expect(def.values?.[prop], `${name}.${prop} без values`).toBeDefined();
                expect((def.values?.[prop] ?? []).length, `${name}.${prop} пустой список`).toBeGreaterThan(0);
            }
        }
    });

    it('перечисления маленькие и машинные', () => {
        for (const [name, def] of practiceEvents) {
            for (const [prop, values] of Object.entries(def.values ?? {})) {
                expect(values.length, `${name}.${prop} слишком большой список`).toBeLessThanOrEqual(12);
                for (const value of values) {
                    expect(value, `${name}.${prop} = ${value}`).toMatch(/^[a-z_]+$|^[A-Z_]+$/);
                }
            }
        }
    });

    it('каждый числовой prop ограничен диапазоном', () => {
        for (const [name, def] of practiceEvents) {
            for (const [prop, type] of Object.entries(def.props ?? {})) {
                if (type !== 'number') continue;
                expect(def.range?.[prop], `${name}.${prop} без range`).toBeDefined();
            }
        }
    });

    it('correlation_id в аналитику не объявлен ни у одного события', () => {
        for (const [, def] of practiceEvents) {
            expect(Object.keys(def.props ?? {})).not.toContain('correlation_id');
        }
    });

    it('каждое событие отвечает на записанный вопрос и объявляет состав', () => {
        for (const [name, def] of practiceEvents) {
            expect(def.question, `${name} без question`).toBeTruthy();
            expect(Array.isArray(def.required), `${name} без required`).toBe(true);
            expect(Array.isArray(def.optional), `${name} без optional`).toBe(true);
        }
    });

    it('имя клиента, спрятанное в source, реестр не пропускает', () => {
        const smuggled = validateEvent(raw('practice_booking_conflict', { source: 'Анна Волкова', error_code: 'SLOT_UNAVAILABLE' }), registry);
        expect(smuggled.valid).toBe(false);
    });

    it('телефон, спрятанный в error_code, реестр не пропускает', () => {
        const smuggled = validateEvent(raw('practice_migration_failed', { source: 'calendar', error_code: '+79991234567' }), registry);
        expect(smuggled.valid).toBe(false);
    });

    it('лишний prop не проходит, даже безобидно названный', () => {
        const extra = validateEvent(raw('practice_booking_succeeded', { source: 'public_booking', details: 'ok' }), registry);
        expect(extra.valid).toBe(false);
    });

    it('одиннадцатое событие ПРАКТИКИ отправить нельзя', () => {
        const unknown = validateEvent(raw('practice_dadata_failed', { provider: 'dadata' }), registry);
        expect(unknown.valid).toBe(false);
    });
});
