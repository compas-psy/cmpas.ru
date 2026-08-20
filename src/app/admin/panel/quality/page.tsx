import { screen, countAllHonestHoles } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { FreshnessRow, RejectedEvents, SilenceRow, SourceDiffRow } from '@/lib/panel/queries/quality';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card, CapsLabel, StateGlyph } from '@/components/panel/block';
import { dec, duration, num, pct, plural, timeOf } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/** Экран 7 — «Качество данных»: чему из показанного вообще можно верить. */
export default async function QualityScreen() {
    const [{ blocks, generatedAt }, holes] = await Promise.all([screen('quality'), countAllHonestHoles()]);

    return (
        <>
            <ScreenHeader
                screenNo={7}
                title="Качество данных"
                screenKey="quality"
                filters={[{ label: 'Период', value: '28 дней' }]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                <Card>
                    <CapsLabel>Что мы не умеем измерять</CapsLabel>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span className="p-mono" style={{ fontSize: 38, fontWeight: 700, color: 'var(--un-fg)' }}>
                            {num(holes)}
                        </span>
                        <span style={{ fontSize: 14, color: 'var(--p-muted)' }}>
                            {plural(holes, 'честная дыра', 'честные дыры', 'честных дыр')} по всей панели — блоков, у которых
                            нет источника. Число считается на лету, а не проставлено руками.
                        </span>
                    </div>
                </Card>

                <Grid cols={2} gap={12}>
                    <Card>
                        <BlockFrame block={pick<RejectedEvents>(blocks, 'rejected')} label="Отвергнуто при приёме" minHeight={180}>
                            {(d) => (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                        <span className="p-mono" style={{ fontSize: 30, fontWeight: 700 }}>
                                            {dec(d.ratePercent, 1)}
                                        </span>
                                        <span style={{ fontSize: 13, color: 'var(--p-muted)' }}>
                                            % событий за {d.windowDays} дней · {num(d.rejected)} из {num(d.accepted + d.rejected)}
                                        </span>
                                    </div>
                                    {d.reasons.length === 0 ? (
                                        <div style={{ fontSize: 12.5, color: 'var(--ok-fg)' }}>
                                            Ни одно событие не отвергнуто — это измеренный ноль, а не отсутствие данных.
                                        </div>
                                    ) : (
                                        d.reasons.map((r) => (
                                            <div key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--p-border)' }}>
                                                <span style={{ color: 'var(--p-muted)' }}>{r.reason}</span>
                                                <span className="p-mono" style={{ fontWeight: 600 }}>
                                                    {num(r.count)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </>
                            )}
                        </BlockFrame>
                    </Card>

                    <Card tone="serious">
                        <BlockFrame block={pick<SilenceRow[]>(blocks, 'silence')} label="Тишина данных" minHeight={180}>
                            {(rows) => (
                                <>
                                    <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                                        Поток события прекратился — почти всегда сломанная разметка, а не изменившееся поведение.
                                    </div>
                                    <div data-scroll-x>
                                        <div style={{ minWidth: 320 }}>
                                            {rows.map((r) => (
                                                <div key={r.event} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--p-border)', alignItems: 'center' }}>
                                                    <span className="p-mono">{r.event}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: silenceColor(r.severity), justifyContent: 'flex-end' }}>
                                                        <StateGlyph state={silenceGlyph(r.severity)} size={13} />
                                                        <span>{silenceLabel(r)}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </BlockFrame>
                    </Card>
                </Grid>

                <Card>
                    <BlockFrame block={pick<SourceDiffRow[]>(blocks, 'sourceDiff')} label="Расхождение независимых источников" minHeight={160}>
                        {(rows) => (
                            <div data-scroll-x>
                                <div style={{ minWidth: 480 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 92px', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--p-sub)', paddingBottom: 6 }}>
                                        <span>Величина</span>
                                        <span>Источник А</span>
                                        <span>Источник Б</span>
                                        <span>Расхождение</span>
                                    </div>
                                    {rows.map((r) => (
                                        <div key={r.label} style={{ padding: '8px 0', borderTop: '1px solid var(--p-border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 92px', gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
                                                <span>{r.label}</span>
                                                <span className="p-mono">{r.sourceA.value === null ? '—' : num(r.sourceA.value)}</span>
                                                <span className="p-mono">{r.sourceB.value === null ? '—' : num(r.sourceB.value)}</span>
                                                <span className="p-mono" style={{ color: r.diffPercent === null ? 'var(--un-fg)' : undefined }}>
                                                    {r.diffPercent === null ? 'не сверить' : pct(r.diffPercent)}
                                                </span>
                                            </div>
                                            {r.reason ? (
                                                <div style={{ fontSize: 11.5, color: 'var(--un-fg)', marginTop: 3 }}>{r.reason}</div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </BlockFrame>
                </Card>

                <Card>
                    <BlockFrame block={pick<FreshnessRow[]>(blocks, 'freshness')} label="Свежесть экранов" minHeight={110}>
                        {(rows) => (
                            <Grid cols={3} gap={10}>
                                {rows.map((r) => (
                                    <div key={r.screen} style={{ background: 'var(--p-inset)', borderRadius: 12, padding: 12 }}>
                                        <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>{r.title}</div>
                                        <div className="p-mono" style={{ fontSize: 15, fontWeight: 600, color: freshnessColor(r.severity) }}>
                                            {r.generatedAt ? timeOf(r.generatedAt) : 'не считался'}
                                        </div>
                                    </div>
                                ))}
                            </Grid>
                        )}
                    </BlockFrame>
                </Card>
            </ScreenBody>
        </>
    );
}

function silenceLabel(row: SilenceRow): string {
    if (row.silentHours === null) return 'поток не начинался';
    if (row.severity === 'ok') return 'поток идёт';
    return `тихо ${duration(row.silentHours)}`;
}

function silenceColor(severity: SilenceRow['severity']): string {
    if (severity === 'serious') return 'var(--se-fg)';
    if (severity === 'warning') return 'var(--wa-fg)';
    if (severity === 'never') return 'var(--un-fg)';
    return 'var(--ok-fg)';
}

function silenceGlyph(severity: SilenceRow['severity']): 'ok' | 'warning' | 'serious' | 'unverified' {
    if (severity === 'serious') return 'serious';
    if (severity === 'warning') return 'warning';
    if (severity === 'never') return 'unverified';
    return 'ok';
}

function freshnessColor(severity: FreshnessRow['severity']): string {
    if (severity === 'serious') return 'var(--se-fg)';
    if (severity === 'warning') return 'var(--wa-fg)';
    if (severity === 'unknown') return 'var(--un-fg)';
    return 'var(--ok-fg)';
}
