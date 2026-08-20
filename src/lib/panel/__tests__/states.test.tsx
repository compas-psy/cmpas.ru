/**
 * Разметка состояний (приёмка §9).
 *
 * Здесь проверяется то, что нельзя проверить на уровне данных: что
 * «данных нет» и измеренный ноль выглядят по-разному, а «не проверено»
 * не окрашивается в зелёный.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlockFrame } from '../../../components/panel/block';
import { Lamp } from '../../../components/panel/lamp';
import { StatTile } from '../../../components/panel/stat';
import { noData, ok, broken, stale, loading } from '../types';
import type { LampState } from '../types';

function render(node: React.ReactElement): string {
    return renderToStaticMarkup(node);
}

describe('состояния блока', () => {
    const measuredZero = render(
        <BlockFrame block={ok('q_demo', { value: 0 })} label="Показатель">
            {(d) => <StatTile label="Показатель" value={String(d.value)} />}
        </BlockFrame>,
    );

    const missing = render(
        <BlockFrame block={noData<{ value: number }>('q_demo', 'приёмник выключен с 12.08')} label="Показатель">
            {(d) => <StatTile label="Показатель" value={String(d.value)} />}
        </BlockFrame>,
    );

    it('измеренный ноль рисуется как обычное число', () => {
        expect(measuredZero).toContain('data-block-state="ok"');
        expect(measuredZero).toContain('>0<');
        expect(measuredZero).not.toContain('dashed');
        expect(measuredZero).not.toContain('Данных нет');
    });

    it('«данных нет» рисуется пунктиром с причиной и НЕ показывает ноль', () => {
        expect(missing).toContain('data-block-state="no_data"');
        expect(missing).toContain('dashed');
        expect(missing).toContain('Данных нет');
        expect(missing).toContain('приёмник выключен с 12.08');
        // Ключевое требование ТЗ §4: ни одного нуля в разметке отсутствия данных.
        expect(missing).not.toMatch(/>\s*0\s*</);
    });

    it('разметка отсутствия данных и измеренного нуля различается', () => {
        expect(missing).not.toBe(measuredZero);
        expect(missing.includes('dashed')).toBe(true);
        expect(measuredZero.includes('dashed')).toBe(false);
    });

    it('каждое состояние подписывает свой источник', () => {
        for (const markup of [measuredZero, missing]) {
            expect(markup).toContain('источник: q_demo');
        }
    });

    it('«сломано» объясняет причину и не притворяется нулём', () => {
        const markup = render(
            <BlockFrame block={broken<{ value: number }>('q_demo', 'таймаут запроса к базе')} label="Показатель">
                {(d) => <StatTile label="Показатель" value={String(d.value)} />}
            </BlockFrame>,
        );
        expect(markup).toContain('data-block-state="broken"');
        expect(markup).toContain('Запрос падает');
        expect(markup).toContain('таймаут запроса к базе');
        expect(markup).not.toMatch(/>\s*0\s*</);
    });

    it('«устарело» гасит блок и подписывает причину, но данные показывает', () => {
        const markup = render(
            <BlockFrame block={stale('q_demo', { value: 42 }, 'коллектор молчит 3 ч', new Date().toISOString())} label="Показатель">
                {(d) => <StatTile label="Показатель" value={String(d.value)} />}
            </BlockFrame>,
        );
        expect(markup).toContain('data-block-state="stale"');
        expect(markup).toContain('opacity:0.72');
        expect(markup).toContain('коллектор молчит 3 ч');
        expect(markup).toContain('>42<');
    });

    it('«загрузка» показывает скелетоны формы контента, а не спиннер', () => {
        const markup = render(
            <BlockFrame block={loading<{ value: number }>('q_demo')} label="Показатель">
                {(d) => <StatTile label="Показатель" value={String(d.value)} />}
            </BlockFrame>,
        );
        expect(markup).toContain('data-block-state="loading"');
        expect(markup).toContain('aria-busy="true"');
        expect(markup).not.toContain('spinner');
    });
});

describe('лампа состояния', () => {
    const ALL: LampState[] = ['ok', 'warning', 'serious', 'broken', 'unverified', 'loading'];

    it('все шесть состояний рисуются и различимы', () => {
        const seen = new Set<string>();
        for (const state of ALL) {
            const markup = render(<Lamp title="Система" state={state} detail="подробность" />);
            expect(markup).toContain(`data-lamp-state="${state}"`);
            seen.add(markup);
        }
        expect(seen.size).toBe(ALL.length);
    });

    it('«не проверено» никогда не зелёное и объясняет, что это не «хорошо»', () => {
        const markup = render(<Lamp title="Приложение" state="unverified" detail="нет сигнала от приложений" />);

        expect(markup).toContain('var(--un-bg)');
        expect(markup).toContain('var(--un-fg)');
        expect(markup).toContain('dashed');
        expect(markup).toContain('это не «хорошо»');
        // Ни один токен «в порядке» не должен попасть в разметку этой лампы.
        for (const okToken of ['var(--ok-bg)', 'var(--ok-fg)', 'var(--ok-br)']) {
            expect(markup, `«не проверено» покрашено токеном ${okToken}`).not.toContain(okToken);
        }
    });

    it('состояние всегда подписано словом, а не только цветом', () => {
        const words: Record<LampState, string> = {
            ok: 'в порядке',
            warning: 'внимание',
            serious: 'серьёзно',
            broken: 'сломано',
            unverified: 'не проверено',
            loading: 'считаем',
        };
        for (const state of ALL) {
            const markup = render(<Lamp title="Система" state={state} detail="подробность" />);
            expect(markup).toContain(words[state]);
            // Плюс глиф: цвет никогда не работает в одиночку.
            expect(markup).toContain('<svg');
        }
    });
});
