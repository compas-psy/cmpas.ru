import Link from 'next/link';
import { screen, countAllHonestHoles } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import { isProductKey, PRODUCTS, type ProductKey } from '@/lib/panel/screens';
import type {
    PracticeActivation,
    PracticeActive,
    PracticeNsm,
    PracticeReschedule,
    ZapiskiWriters,
    ZapiskiSyncs,
    ZapiskiConflicts,
    MomentyActivation,
    MomentyInstalls,
    MomentyRetention,
    PracticeMobile,
} from '@/lib/panel/queries/products';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card } from '@/components/panel/block';
import { StatTile, TrendPill } from '@/components/panel/stat';
import { HonestZero } from '@/components/panel/meters';
import { dec, num, plural } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/** Экран 3 — «Продукты». Табы продуктов — query-параметр, а не смена маршрута. */
export default async function ProductsScreen({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
    const params = await searchParams;
    const product: ProductKey = isProductKey(params.p) ? params.p : 'practice';
    const [{ blocks, generatedAt }, holes] = await Promise.all([screen('products', product), countAllHonestHoles()]);

    return (
        <>
            <ScreenHeader
                screenNo={3}
                title="Продукты"
                screenKey="products"
                filters={[{ label: 'Период', value: '28 дней' }]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                {/* Сегмент-переключатель */}
                <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--p-inset)', borderRadius: 14, width: 'fit-content' }}>
                    {PRODUCTS.map((p) => (
                        <Link
                            key={p.key}
                            href={`/admin/panel/products?p=${p.key}`}
                            data-tab
                            data-active={p.key === product}
                            aria-current={p.key === product ? 'page' : undefined}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 11,
                                color: p.key === product ? 'var(--p-ink)' : 'var(--p-muted)',
                                fontSize: 13,
                                fontWeight: 600,
                                letterSpacing: '.02em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                            }}
                        >
                            {/* Цвет закреплён за продуктом и не зависит от того, какой таб открыт. */}
                            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 3, background: `var(--${p.slot})` }} />
                            {p.title}
                        </Link>
                    ))}
                </div>

                {product === 'practice' ? <Practice blocks={blocks} /> : null}
                {product === 'zapiski' ? <Zapiski blocks={blocks} /> : null}
                {product === 'momenty' ? <Momenty blocks={blocks} /> : null}

                <Link
                    href="/admin/panel/quality"
                    style={{ fontSize: 12.5, color: 'var(--p-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                    Что мы не умеем измерять — {num(holes)} {plural(holes, 'честная дыра', 'честные дыры', 'честных дыр')}
                </Link>
            </ScreenBody>
        </>
    );
}

type Blocks = Awaited<ReturnType<typeof screen>>['blocks'];

function Practice({ blocks }: { blocks: Blocks }) {
    const nsm = pick<PracticeNsm>(blocks, 'nsm');
    const active = pick<PracticeActive>(blocks, 'active');
    const activation = pick<PracticeActivation>(blocks, 'activation');
    const reschedule = pick<PracticeReschedule>(blocks, 'reschedule');
    const bookingAuthor = pick<never>(blocks, 'bookingAuthor');
    const reminders = pick<never>(blocks, 'reminders');
    const mobile = pick<PracticeMobile>(blocks, 'mobile');

    return (
        <>
            <Card>
                <BlockFrame block={nsm} label="Главная метрика ПРАКТИКИ" minHeight={110}>
                    {(d) => (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                                <span className="p-mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.03em' }}>
                                    {dec(d.value)}
                                </span>
                                <span style={{ fontSize: 14, color: 'var(--p-muted)' }}>сессии на активного специалиста в неделю</span>
                            </div>
                            <span style={{ marginLeft: 'auto' }}>
                                <TrendPill delta={d.delta} />
                            </span>
                        </div>
                    )}
                </BlockFrame>
            </Card>

            <Grid cols={3}>
                <BlockFrame block={active} label="Активные специалисты">
                    {(d) => <StatTile value={`${num(d.wau)} / ${num(d.mau)}`} delta={d.delta} note={`WAU / MAU · липкость ${dec(d.stickiness, 0)} %`} />}
                </BlockFrame>
                <BlockFrame block={activation} label="Активация за 7 дней">
                    {(d) => <StatTile value={dec(d.rate)} unit="%" delta={d.delta} note={`${num(d.activated)} из ${num(d.cohort)}`} />}
                </BlockFrame>
                <BlockFrame block={reschedule} label="Переносы и отмены">
                    {(d) => <StatTile value={dec(d.rate)} unit="%" note={`${num(d.cancelled)} из ${num(d.total)} записей за 28 дней`} />}
                </BlockFrame>
            </Grid>

            <Grid cols={2} gap={12}>
                <Card>
                    <BlockFrame block={bookingAuthor} label="Кто заводит запись" minHeight={120}>
                        {() => null}
                    </BlockFrame>
                </Card>
                <Card>
                    <BlockFrame block={reminders} label="Напоминания ушли вовремя" minHeight={120}>
                        {() => null}
                    </BlockFrame>
                </Card>
            </Grid>

            <Card>
                <BlockFrame block={mobile} label="С телефона" minHeight={130}>
                    {(d) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Оговорка стоит ПЕРВОЙ и набрана заметнее самих чисел.
                                События шлют только согласившиеся, а знаменатель считается
                                по всем — значит любая доля ниже оценка снизу, а не факт.
                                Спрятать эту строку под числа означало бы выдать оценку
                                за измерение. */}
                            <div
                                style={{
                                    fontSize: 13,
                                    lineHeight: 1.45,
                                    color: 'var(--p-muted)',
                                    borderLeft: '2px solid var(--p-line)',
                                    paddingLeft: 10,
                                }}
                            >
                                {d.consentShare === null ? (
                                    <>Активных специалистов нет — долю согласий не с чем сравнить.</>
                                ) : (
                                    <>
                                        Оценка, не факт: согласие на аналитику дали{' '}
                                        <strong>{dec(d.consentShare, 1)} %</strong> специалистов
                                        ({num(d.consented)} из {num(d.activeSpecialists)}). Остальные
                                        не шлют событий вовсе, поэтому доли ниже занижены.
                                    </>
                                )}
                            </div>
                            <Grid cols={2} gap={12}>
                                <StatTile
                                    value={d.mobileShare === null ? '—' : dec(d.mobileShare, 1)}
                                    unit={d.mobileShare === null ? undefined : '%'}
                                    note={`записей с телефона: ${num(d.mobileSessions)} из ${num(d.totalSessions)} за 7 дней`}
                                />
                                <StatTile
                                    value={d.undeliveredShare === null ? '—' : dec(d.undeliveredShare, 1)}
                                    unit={d.undeliveredShare === null ? undefined : '%'}
                                    note="действий с телефона не дошло до сервера"
                                />
                            </Grid>
                        </div>
                    )}
                </BlockFrame>
            </Card>
        </>
    );
}

function Zapiski({ blocks }: { blocks: Blocks }) {
    const nsm = pick<never>(blocks, 'zapiskiNsm');
    const writers = pick<ZapiskiWriters>(blocks, 'zapiskiWriters');
    const notesPerSession = pick<never>(blocks, 'zapiskiNotesPerSession');
    const syncs = pick<ZapiskiSyncs>(blocks, 'zapiskiSyncs');
    const conflicts = pick<ZapiskiConflicts>(blocks, 'zapiskiConflicts');
    const support = pick<never>(blocks, 'zapiskiSupport');

    return (
        <>
            <Card>
                <div style={{ fontSize: 14, lineHeight: '20px' }}>
                    Общий приёмник событий у ЗАПИСОК заработал: часть показателей ниже теперь считается по
                    настоящим событиям. Оставшиеся — честная дыра не из-за отсутствия приёмника, а потому
                    что под них нет определения, которое можно вычислить: заметка не привязана к сессии
                    (нет `session_id`), обращения в поддержку в этот приёмник не отправляются.
                </div>
            </Card>
            <Grid cols={3}>
                <BlockFrame block={nsm} label="Сессий закрыто заметкой">
                    {() => null}
                </BlockFrame>
                <BlockFrame block={writers} label="Пишут хоть что-то">
                    {(d) => <StatTile value={num(d.count)} delta={d.delta} note={`субъектов с заметкой за ${d.windowDays} дней`} />}
                </BlockFrame>
                <BlockFrame block={notesPerSession} label="Заметок на сессию">
                    {() => null}
                </BlockFrame>
                <BlockFrame block={syncs} label="Синхронизаций">
                    {(d) => (
                        <StatTile
                            value={num(d.count)}
                            delta={d.delta}
                            note={`push ${num(d.pushed)} · pull ${num(d.pulled)} · ${d.windowDays} дней`}
                        />
                    )}
                </BlockFrame>
                <BlockFrame block={conflicts} label="Конфликтов">
                    {(d) => (
                        <StatTile
                            value={num(d.count)}
                            delta={d.delta}
                            note={`из ${num(d.syncsTotal)} синков${d.ratePercent !== null ? ` · ${dec(d.ratePercent)} %` : ''}`}
                        />
                    )}
                </BlockFrame>
                <BlockFrame block={support} label="Бета: обращения">
                    {() => null}
                </BlockFrame>
            </Grid>
        </>
    );
}

function Momenty({ blocks }: { blocks: Blocks }) {
    const nsm = pick<MomentyActivation>(blocks, 'momentyNsm');
    const installs = pick<MomentyInstalls>(blocks, 'momentyInstalls');
    const d1 = pick<MomentyRetention>(blocks, 'momentyD1');
    const d7 = pick<MomentyRetention>(blocks, 'momentyD7');
    const d30 = pick<MomentyRetention>(blocks, 'momentyD30');

    return (
        <>
            <Card>
                <div style={{ fontSize: 14, lineHeight: '20px' }}>
                    МОМЕНТЫ шлют события в общий приёмник с включённым транспортом: установки и активация
                    считаются по ним. Удержание D1/D7/D30 появляется по когортам устройств по мере того,
                    как для них наступает соответствующий день — до этого блок честно показывает нехватку
                    истории, а не ноль процентов.
                </div>
            </Card>
            <Grid cols={3}>
                <BlockFrame block={nsm} label="Завершили первую практику в первый день">
                    {(d) => (
                        <StatTile
                            value={dec(d.rate)}
                            unit="%"
                            delta={d.delta}
                            note={`${num(d.activated)} из ${num(d.cohort)} за ${d.windowDays} дней`}
                        />
                    )}
                </BlockFrame>
                <BlockFrame block={installs} label="Установок в неделю">
                    {(d) => <StatTile value={num(d.count)} delta={d.delta} note={`за ${d.windowDays} дней`} />}
                </BlockFrame>
                <BlockFrame block={d1} label="D1">
                    {(d) => <StatTile value={dec(d.percent)} unit="%" note={`${num(d.retained)} из ${num(d.cohort)}`} />}
                </BlockFrame>
                <BlockFrame block={d7} label="D7">
                    {(d) => <StatTile value={dec(d.percent)} unit="%" note={`${num(d.retained)} из ${num(d.cohort)}`} />}
                </BlockFrame>
                <BlockFrame block={d30} label="D30">
                    {(d) => <StatTile value={dec(d.percent)} unit="%" note={`${num(d.retained)} из ${num(d.cohort)}`} />}
                </BlockFrame>
            </Grid>
            <Card>
                <BlockFrame block={pick<{ count: number }>(blocks, 'crossProduct')} label="Переходы в другие продукты" minHeight={130}>
                    {(d) =>
                        d.count === 0 ? (
                            <HonestZero
                                title="Переходы в другие продукты"
                                explanation="Точек перехода между продуктами в коде нет ни у одного из них: событие crossed_to_product есть в реестре, но его никто не отправляет. График появится, когда появится механика."
                            />
                        ) : (
                            <div className="p-mono" style={{ fontSize: 38, fontWeight: 700 }}>
                                {num(d.count)}
                            </div>
                        )
                    }
                </BlockFrame>
            </Card>
        </>
    );
}
