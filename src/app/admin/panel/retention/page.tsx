import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { ChurnData, CohortsData } from '@/lib/panel/queries/retention';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card } from '@/components/panel/block';
import { dateOf, dec, num, plural } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/** Экран 5 — «Удержание». */
export default async function RetentionScreen() {
    const { blocks, generatedAt } = await screen('retention');

    const cohorts = pick<CohortsData>(blocks, 'cohorts');
    const momenty = pick<CohortsData>(blocks, 'momentyRetention');
    const churnCount = pick<ChurnData>(blocks, 'churnCount');
    const churnReasons = pick<never>(blocks, 'churnReasons');

    return (
        <>
            <ScreenHeader
                screenNo={5}
                title="Удержание"
                screenKey="retention"
                filters={[{ label: 'Период', value: '6 недель' }]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                <Card>
                    <BlockFrame block={cohorts} label="Когорты специалистов" minHeight={220}>
                        {(d) => (
                            <>
                                <Heatmap data={d} />
                                {/* Честный ноль окна наблюдения (B4, тот же корень, что у
                                    воронки ПРАКТИКИ рядом): пустые строки — не «данных нет»,
                                    если специалисты вообще когда-то регистрировались. */}
                                {d.rows.length === 0 && d.lastRegisteredAt ? (
                                    <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                                        в окно наблюдения никто не зарегистрировался — последняя регистрация {dateOf(d.lastRegisteredAt)} (
                                        {num(d.daysSinceLastRegistered ?? 0)} дн назад)
                                    </div>
                                ) : null}
                            </>
                        )}
                    </BlockFrame>
                </Card>

                <Grid cols={2} gap={12}>
                    <Card>
                        <BlockFrame block={momenty} label="Удержание МОМЕНТОВ" minHeight={160}>
                            {(d) => <Heatmap data={d} />}
                        </BlockFrame>
                    </Card>
                    <Card>
                        <BlockFrame block={churnCount} label="Ушедшие за 28 дней" minHeight={160}>
                            {(d) => (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                                        <span className="p-mono" style={{ fontSize: 32, fontWeight: 700 }}>
                                            {num(d.churned)}
                                        </span>
                                        <span style={{ fontSize: 13.5, color: 'var(--p-muted)' }}>
                                            {plural(d.churned, 'специалист', 'специалиста', 'специалистов')} · {dec(d.ratePercent)} % базы
                                        </span>
                                    </div>
                                    <BlockFrame block={churnReasons} label="Причины ухода" minHeight={80}>
                                        {() => null}
                                    </BlockFrame>
                                </>
                            )}
                        </BlockFrame>
                    </Card>
                </Grid>
            </ScreenBody>
        </>
    );
}

/**
 * Тепловая карта когорт. Заливка — последовательная шкала одного тона
 * (`--heat`) от светлого к тёмному: это величина, а не идентичность.
 *
 * Ячейка, срок которой ещё не наступил, рисуется как «рано» пунктиром — это
 * отдельное состояние, не `no_data` и тем более не ноль.
 */
function Heatmap({ data }: { data: CohortsData }) {
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--p-sub)' }}>
                <span>0 %</span>
                <span
                    aria-hidden
                    style={{
                        width: 120,
                        height: 10,
                        borderRadius: 999,
                        background: 'linear-gradient(to right, color-mix(in srgb, var(--heat) 6%, transparent), var(--heat))',
                    }}
                />
                <span>60 %</span>
            </div>

            <div data-scroll-x>
                <div style={{ minWidth: 520, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `112px repeat(${data.columns.length}, minmax(0, 1fr))`, gap: 4 }}>
                        <span />
                        {data.columns.map((col) => (
                            <span key={col} className="p-mono" style={{ fontSize: 10.5, color: 'var(--p-sub)', textAlign: 'center' }}>
                                {col}
                            </span>
                        ))}
                    </div>
                    {data.rows.map((row) => (
                        <div key={row.label} style={{ display: 'grid', gridTemplateColumns: `112px repeat(${data.columns.length}, minmax(0, 1fr))`, gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                                {row.label} · <span className="p-mono">{num(row.size)}</span>
                            </span>
                            {row.cells.map((cell, i) => (
                                <Cell key={i} cell={cell} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

function Cell({ cell }: { cell: CohortsData['rows'][number]['cells'][number] }) {
    if (cell.kind === 'too_early') {
        return (
            <span
                title="Срок ещё не наступил — это не ноль"
                style={{
                    height: 34,
                    borderRadius: 6,
                    border: '1px dashed var(--p-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: 'var(--p-sub)',
                }}
            >
                рано
            </span>
        );
    }
    if (cell.kind === 'no_data') {
        return (
            <span
                title={cell.reason}
                style={{
                    height: 34,
                    borderRadius: 6,
                    border: '1px dashed var(--un-br)',
                    background: 'var(--un-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10.5,
                    color: 'var(--un-fg)',
                }}
            >
                нет данных
            </span>
        );
    }
    const share = Math.max(4, Math.min(100, cell.percent));
    return (
        <span
            className="p-mono"
            style={{
                height: 34,
                borderRadius: 6,
                background: `color-mix(in srgb, var(--heat) ${share}%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--p-ink)',
            }}
        >
            {dec(cell.percent, 0)}
        </span>
    );
}
