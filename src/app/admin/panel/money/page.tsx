import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { Arpu, FailedQueue, MrrMonthly, MrrWaterfall, PaymentsDaily, PayingUsers, RevenueChurn } from '@/lib/panel/queries/money';
import type { InfraCostCard } from '@/lib/panel/queries/tech';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card, CapsLabel } from '@/components/panel/block';
import { StatTile } from '@/components/panel/stat';
import { InsetTile, ThresholdBar } from '@/components/panel/meters';
import { SingleAxisLine } from '@/components/panel/charts';
import { InfraCostForm } from '@/components/panel/manual-value';
import { dateOf, dec, num, pct, plural, rub } from '@/lib/panel/format';
import { severityFor } from '@/lib/panel/thresholds';

export const dynamic = 'force-dynamic';

/** Экран 2 — «Деньги». */
export default async function MoneyScreen() {
    const { blocks, generatedAt } = await screen('money');

    const mrr = pick<MrrMonthly>(blocks, 'mrr');
    const paying = pick<PayingUsers>(blocks, 'payingUsers');
    const arpu = pick<Arpu>(blocks, 'arpu');
    const trial = pick<{ rate: number; delta: Arpu['delta']; converted: number; cohort: number }>(blocks, 'trialConversion');
    const churn = pick<RevenueChurn>(blocks, 'revenueChurn');
    const payments = pick<PaymentsDaily>(blocks, 'paymentsDaily');
    const waterfall = pick<MrrWaterfall>(blocks, 'mrrWaterfall');
    const failed = pick<FailedQueue>(blocks, 'failedQueue');
    const cost = pick<InfraCostCard>(blocks, 'infraCost');

    return (
        <>
            <ScreenHeader
                screenNo={2}
                title="Деньги"
                screenKey="money"
                filters={[
                    { label: 'Период', value: '28 дней' },
                    { label: 'Продукт', value: 'все' },
                ]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                {/* Полоса KPI */}
                <Grid cols={6}>
                    <BlockFrame block={mrr} label="MRR">
                        {(d) => <StatTile value={rub(d.current)} unit="₽" delta={d.delta} />}
                    </BlockFrame>
                    <BlockFrame block={paying} label="Платящих">
                        {(d) => <StatTile value={num(d.active)} delta={d.delta} note={`триал ${num(d.trial)} · отсрочка ${num(d.grace)}`} />}
                    </BlockFrame>
                    <BlockFrame block={arpu} label="Средний чек">
                        {(d) => <StatTile value={rub(d.value)} unit="₽" delta={d.delta} note={`${num(d.payers)} ${plural(d.payers, 'плательщик', 'плательщика', 'плательщиков')}`} />}
                    </BlockFrame>
                    <BlockFrame block={trial} label="Триал → оплата">
                        {(d) => <StatTile value={dec(d.rate)} unit="%" delta={d.delta} note={`${num(d.converted)} из ${num(d.cohort)}`} />}
                    </BlockFrame>
                    <BlockFrame block={churn} label="Отток по деньгам">
                        {(d) => <StatTile value={dec(d.rate)} unit="%" delta={d.delta} note={`ушли ${num(d.churned)}`} />}
                    </BlockFrame>
                    <BlockFrame block={payments} label="Успешность списаний">
                        {(d) => {
                            const severity = severityFor('paymentSuccess', d.rate);
                            return (
                                <StatTile
                                    value={dec(d.rate)}
                                    unit="%"
                                    tone={severity === 'serious' ? 'serious' : severity === 'warning' ? 'warning' : 'plain'}
                                    note={`${num(d.paid)} из ${num(d.total)} за ${d.windowDays} дней`}
                                />
                            );
                        }}
                    </BlockFrame>
                </Grid>

                <Grid cols={2} gap={12}>
                    {/* MRR по месяцам — одна серия, одна ось */}
                    <Card>
                        <BlockFrame block={mrr} label="MRR по месяцам" minHeight={220}>
                            {(d) => (
                                <>
                                    <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>Одна серия, одна ось. 12 месяцев, ₽</div>
                                    <SingleAxisLine
                                        data={d.months.map((m) => ({ label: m.label, value: m.value === null ? null : Math.round(m.value / 100) }))}
                                        slot="c1"
                                        title="Выручка по месяцам, ₽"
                                        unit="₽"
                                        format="rub"
                                    />
                                </>
                            )}
                        </BlockFrame>
                    </Card>

                    {/* Водопад: направление кодируется позицией, цвет его лишь дублирует */}
                    <Card>
                        <BlockFrame block={waterfall} label="Из чего сложилось изменение MRR" minHeight={220}>
                            {(d) => {
                                const rows = [
                                    { label: 'Новые', value: d.newRevenue, slot: 'c1', dim: false },
                                    { label: 'Расширение', value: d.expansion, slot: 'c1', dim: true },
                                    { label: 'Сжатие', value: d.contraction, slot: 'c4', dim: true },
                                    { label: 'Отток', value: d.churn, slot: 'c4', dim: false },
                                ];
                                const scale = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
                                return (
                                    <>
                                        <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>За 30 дней, ₽ · прирост вправо, потеря влево</div>
                                        {rows.map((r) => (
                                            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 84px', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>{r.label}</span>
                                                <div style={{ position: 'relative', height: 22, background: 'var(--p-inset)', borderRadius: 6 }}>
                                                    <span aria-hidden style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--p-border)' }} />
                                                    <span
                                                        style={{
                                                            position: 'absolute',
                                                            top: 3,
                                                            bottom: 3,
                                                            width: `${(Math.abs(r.value) / scale) * 48}%`,
                                                            background: `var(--${r.slot})`,
                                                            opacity: r.dim ? 0.65 : 1,
                                                            ...(r.value >= 0
                                                                ? { left: '50%', borderRadius: '0 4px 4px 0' }
                                                                : { right: '50%', borderRadius: '4px 0 0 4px' }),
                                                        }}
                                                    />
                                                </div>
                                                <span className="p-mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>
                                                    {r.value >= 0 ? '+' : '−'}
                                                    {rub(Math.abs(r.value))}
                                                </span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 84px', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid var(--p-border)' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>Итого</span>
                                            <span />
                                            <span className="p-mono" style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>
                                                {d.net >= 0 ? '+' : '−'}
                                                {rub(Math.abs(d.net))}
                                            </span>
                                        </div>
                                    </>
                                );
                            }}
                        </BlockFrame>
                    </Card>
                </Grid>

                <Grid cols={2} gap={12}>
                    {/* Списания с порогами внутри счётчика */}
                    <Card>
                        <BlockFrame block={payments} label="Списания за 30 дней" minHeight={180}>
                            {(d) => (
                                <>
                                    <ThresholdBar
                                        thresholdKey="paymentSuccess"
                                        value={d.rate}
                                        label="успешность списаний"
                                        valueLabel={pct(d.rate)}
                                    />
                                    <Grid cols={2} gap={10}>
                                        <BlockFrame block={failed} label="Очередь неудач" minHeight={70}>
                                            {(q) => (
                                                <InsetTile label="Очередь неудач">
                                                    <div className="p-mono" style={{ fontSize: 22, fontWeight: 700 }}>
                                                        {num(q.count)}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>
                                                        ≈ {rub(q.amount)} ₽ ждут повтора
                                                    </div>
                                                    {q.olderThan30d > 0 ? (
                                                        <div style={{ fontSize: 11.5, color: 'var(--wa-fg)', marginTop: 4 }}>
                                                            {num(q.olderThan30d)} висят дольше 30 дней · самый старый {dateOf(q.oldestAt)}
                                                        </div>
                                                    ) : null}
                                                </InsetTile>
                                            )}
                                        </BlockFrame>
                                        <InsetTile label="Терминалы">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                                {d.terminals.map((t) => (
                                                    <div key={t.terminal} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                        <span style={{ color: 'var(--p-muted)' }}>{t.terminal === 'site' ? 'сайт' : 'приложение'}</span>
                                                        <span className="p-mono" style={{ fontWeight: 600 }}>
                                                            {pct(t.rate)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </InsetTile>
                                    </Grid>
                                </>
                            )}
                        </BlockFrame>
                    </Card>

                    {/* Стоимость инфраструктуры — ручной ввод */}
                    <Card tone={cost.state === 'no_data' ? 'plain' : 'warning'}>
                        <span id="cost" />
                        <BlockFrame block={cost} label="Стоимость инфраструктуры" minHeight={180}>
                            {(d) => (
                                <>
                                    {[
                                        { label: 'Сервер', value: d.server },
                                        { label: 'Хранилище копий', value: d.storage },
                                        { label: 'Домены', value: d.domains },
                                    ].map((row) => (
                                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid var(--p-border)' }}>
                                            <span style={{ fontSize: 13, color: 'var(--p-muted)' }}>{row.label}</span>
                                            <span className="p-mono" style={{ fontSize: 13.5, fontWeight: 600 }}>
                                                {row.value === null ? 'не введено' : `${num(row.value)} ₽/мес`}
                                            </span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '1px solid var(--p-border)' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>Итого расход</span>
                                        <span className="p-mono" style={{ fontSize: 16, fontWeight: 700 }}>
                                            {num(d.total)} ₽
                                        </span>
                                    </div>
                                    <CapsLabel>
                                        {d.source === 'manual' ? 'введено вручную' : 'из биллинга'}
                                        {d.updatedAt ? `, обновлено ${dateOf(d.updatedAt)}` : ''}
                                    </CapsLabel>
                                    <InfraCostForm current={d} />
                                </>
                            )}
                        </BlockFrame>
                        {/* Пока значения нет, блок в no_data и его содержимое не
                            рисуется — форма нужна и в этом случае, иначе ввести
                            первое значение будет негде. */}
                        {cost.state === 'no_data' ? <InfraCostForm current={null} /> : null}
                    </Card>
                </Grid>
            </ScreenBody>
        </>
    );
}
