import { broken, loading, noData, ok, stale, type LampState } from '@/lib/panel/types';
import { PALETTE_SLOTS, CHART_SERIES_REGISTRY } from '@/lib/panel/palette';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card, CapsLabel } from '@/components/panel/block';
import { Lamp } from '@/components/panel/lamp';
import { AttentionRow, StatTile, TrendPill } from '@/components/panel/stat';
import { HonestZero, InsetTile, ThresholdBar } from '@/components/panel/meters';
import { Sparkline, SingleAxisLine, CohortLines, SeriesLegend } from '@/components/panel/charts';
import { deltaAbs, deltaPercent, deltaPoints } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/**
 * Служебный экран: каталог всех состояний всех компонентов.
 *
 * Он существует не «для красоты» — он задаёт контракт состояний. Если новый
 * блок не укладывается ни в один вид отсюда, значит контракт нарушен.
 *
 * Числа на этом экране — заведомо синтетические и объявлены прямо здесь:
 * ни одно из них не приходит из базы и не может утечь на боевой экран.
 */
const DEMO_SERIES = [12, 15, 14, 18, 21, 19, 24, 22, 26, 25, 29, 31].map((value, i) => ({
    label: `Н${i + 1}`,
    value,
}));

const DEMO_WITH_GAP = DEMO_SERIES.map((p, i) => (i === 6 || i === 7 ? { ...p, value: null } : p));

const LAMP_STATES: { state: LampState; detail: string }[] = [
    { state: 'ok', detail: 'списания 96,1 %' },
    { state: 'warning', detail: 'вовремя 97,4 %' },
    { state: 'serious', detail: 'восстановление: никогда' },
    { state: 'broken', detail: 'миграций расходится: 2' },
    { state: 'unverified', detail: 'нет сигнала от приложений' },
    { state: 'loading', detail: 'считаем' },
];

export default function ComponentsScreen() {
    return (
        <>
            <ScreenHeader screenNo={8} title="Библиотека компонентов" screenKey="components" generatedAt={new Date().toISOString()} />
            <ScreenBody>
                <Card>
                    <div style={{ fontSize: 13.5, lineHeight: '19px' }}>
                        Служебный экран. Все числа здесь синтетические и объявлены в исходнике этой страницы — ни одно
                        не приходит из базы. Экран задаёт контракт состояний: блок, не укладывающийся ни в один вид
                        отсюда, сделан неправильно.
                    </div>
                </Card>

                {/* Плитка показателя — пять состояний контракта */}
                <Section title="Плитка показателя · пять состояний">
                    <Grid cols={3} gap={12}>
                        <BlockFrame block={ok('q_demo', { value: 428 })} label="Есть данные">
                            {() => <StatTile label="Платящих" value="428" delta={deltaAbs(428, 409, true)} />}
                        </BlockFrame>

                        <BlockFrame block={loading<{ value: number }>('q_demo')} label="Загрузка">
                            {() => null}
                        </BlockFrame>

                        <BlockFrame block={noData<{ value: number }>('q_demo', 'приёмник событий выключен с 12.08')} label="Данных нет">
                            {() => null}
                        </BlockFrame>

                        <BlockFrame
                            block={stale('q_demo', { value: 412 }, 'последняя удачная выгрузка вчера в 22:10', new Date(Date.now() - 12 * 3600_000).toISOString())}
                            label="Данные устарели"
                        >
                            {() => <StatTile label="Платящих" value="412" />}
                        </BlockFrame>

                        <BlockFrame block={broken<{ value: number }>('q_paying_users', 'таймаут запроса к базе')} label="Сломано">
                            {() => null}
                        </BlockFrame>

                        {/* Ключевое различие: измеренный ноль — обычное число, а не пунктир. */}
                        <BlockFrame block={ok('q_demo_zero', { value: 0 })} label="Измеренный ноль">
                            {() => <StatTile label="Отвергнуто событий" value="0" note="ноль измерен: приёмник работал и отверг ноль событий" />}
                        </BlockFrame>
                    </Grid>
                </Section>

                {/* Лампа состояния — шесть видов */}
                <Section title="Лампа состояния · шесть видов">
                    <Grid cols={6}>
                        {LAMP_STATES.map((l) => (
                            <Lamp key={l.state} title="Система" state={l.state} detail={l.detail} />
                        ))}
                    </Grid>
                    <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                        «Не проверено» никогда не окрашивается в зелёный: серый фон, пунктирная рамка и подпись,
                        объясняющая, что это не «хорошо».
                    </div>
                </Section>

                {/* Пилюли тренда */}
                <Section title="Направление · всегда подписано словом">
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <TrendPill delta={deltaPercent(312, 288, true)} />
                        <TrendPill delta={deltaPoints(46.2, 49.3, true)} />
                        <TrendPill delta={deltaPoints(3.2, 3.6, false)} />
                        <TrendPill delta={deltaAbs(978, 978, true)} />
                    </div>
                </Section>

                {/* Счётчик с порогами */}
                <Section title="Счётчик с порогом · засечки внутри полосы">
                    <Grid cols={2} gap={12}>
                        <Card>
                            <ThresholdBar thresholdKey="paymentSuccess" value={96.1} label="успешность списаний" valueLabel="96,1 %" />
                        </Card>
                        <Card>
                            <ThresholdBar thresholdKey="diskFree" value={17} label="свободно на диске" valueLabel="17 %" />
                        </Card>
                    </Grid>
                </Section>

                {/* Графики */}
                <Section title="Графики · одна ось, разрыв вместо нуля">
                    <Grid cols={2} gap={12}>
                        <Card>
                            <CapsLabel>Спарклайн</CapsLabel>
                            <Sparkline data={DEMO_SERIES} slot="c1" title="Демонстрационная серия" />
                        </Card>
                        <Card>
                            <CapsLabel>Разрыв вместо нуля</CapsLabel>
                            <Sparkline data={DEMO_WITH_GAP} slot="c1" title="Серия с пропуском измерения" />
                            <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                                Две недели не измерялись. Линия рвётся, а не падает в ноль: провал в ноль читался бы как
                                «было ноль».
                            </div>
                        </Card>
                        <Card>
                            <CapsLabel>Линия на одной оси</CapsLabel>
                            <SingleAxisLine data={DEMO_SERIES} slot="c1" title="Демонстрационная серия" />
                        </Card>
                        <Card>
                            <CapsLabel>Две когорты одним тоном</CapsLabel>
                            <CohortLines
                                series={[
                                    { key: 'a', label: 'июль', points: DEMO_SERIES },
                                    { key: 'b', label: 'июнь', dash: '6 5', points: DEMO_SERIES.map((p) => ({ ...p, value: (p.value ?? 0) * 0.7 })) },
                                ]}
                                slot="c3"
                                title="Удержание по когортам"
                            />
                            <SeriesLegend series={[{ label: 'июль' }, { label: 'июнь', dash: '6 5' }]} slot="c3" />
                            <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                                Серии различаются подписью и штрихом, не только цветом.
                            </div>
                        </Card>
                    </Grid>
                </Section>

                {/* Строка «требует вас» */}
                <Section title="Строка «требует вас» · формулировка через последствие">
                    <Card>
                        <AttentionRow
                            title="Схема базы разошлась с репозиторием"
                            consequence="Не применено миграций: 2. Следующая выкладка упадёт молча — ошибка вылезет уже у пользователей."
                            minutes={30}
                            lamp="broken"
                            action={{ label: 'Открыть базу', href: '/admin/panel/tech' }}
                            primary
                        />
                        <AttentionRow
                            title="Учебного восстановления не было ни разу"
                            consequence="Копии снимаются, но никем не разворачивались. Пока это так, бэкапа у нас нет."
                            minutes={20}
                            lamp="serious"
                            action={{ label: 'Назначить проверку', href: '/admin/system' }}
                        />
                    </Card>
                </Section>

                {/* Честный ноль и плашки */}
                <Section title="Честный ноль и плашки">
                    <Grid cols={3} gap={12}>
                        <HonestZero
                            title="Переходы в другие продукты"
                            explanation="Точек перехода между продуктами в коде нет. График появится, когда появится механика."
                        />
                        <InsetTile label="Очередь неудач">
                            <div className="p-mono" style={{ fontSize: 22, fontWeight: 700 }}>
                                17
                            </div>
                        </InsetTile>
                        <InsetTile label="Последняя сборка" tone="unverified">
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--un-fg)' }}>Не проверено</div>
                            <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>нет ответа магазина</div>
                        </InsetTile>
                    </Grid>
                </Section>

                {/* Палитра */}
                <Section title="Категориальная палитра · шесть слотов с закреплением">
                    <Grid cols={6}>
                        {Object.entries(PALETTE_SLOTS).map(([entity, slot]) => (
                            <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ height: 42, borderRadius: 10, background: `var(--${slot})` }} />
                                <span className="p-mono" style={{ fontSize: 11, color: 'var(--p-sub)' }}>
                                    {slot}
                                </span>
                                <span style={{ fontSize: 12 }}>{ENTITY_TITLE[entity] ?? entity}</span>
                            </div>
                        ))}
                    </Grid>
                    <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                        Цвет закреплён за сущностью, а не за местом в списке: фильтр, меняющий состав рядов, не
                        перекрашивает выживших. Слотов ровно шесть, цикла нет.
                    </div>

                    <div data-scroll-x>
                        <div style={{ minWidth: 520 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--p-sub)', paddingBottom: 6 }}>
                                <span>График</span>
                                <span>Слоты</span>
                                <span>Второй канал различения</span>
                            </div>
                            {CHART_SERIES_REGISTRY.map((c) => (
                                <div key={c.chart} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 8, fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--p-border)' }}>
                                    <span className="p-mono">{c.chart}</span>
                                    <span className="p-mono">{c.slots.join(', ') || '—'}</span>
                                    <span style={{ color: 'var(--p-muted)' }}>{c.note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Section>
            </ScreenBody>
        </>
    );
}

const ENTITY_TITLE: Record<string, string> = {
    practice: 'ПРАКТИКА',
    zapiski: 'ЗАПИСКИ',
    momenty: 'МОМЕНТЫ',
    platform: 'Платформа',
    reserve5: 'Резерв',
    reserve6: 'Резерв',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CapsLabel>{title}</CapsLabel>
            {children}
        </div>
    );
}
