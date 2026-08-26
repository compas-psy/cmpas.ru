import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { FunnelData, SourcesData } from '@/lib/panel/queries/funnel';
import { ScreenBody, ScreenHeader } from '@/components/panel/chrome';
import { BlockFrame, Card } from '@/components/panel/block';
import { FunnelRow } from '@/components/panel/meters';
import { dateOf, dec, num, plural } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/** Экран 4 — «Путь и активация». */
export default async function FunnelScreen() {
    const { blocks, generatedAt } = await screen('funnel');

    const practice = pick<FunnelData>(blocks, 'practiceFunnel');
    const booking = pick<FunnelData>(blocks, 'bookingFunnel');
    const sources = pick<SourcesData>(blocks, 'sources');

    return (
        <>
            <ScreenHeader
                screenNo={4}
                title="Путь и активация"
                screenKey="funnel"
                filters={[
                    { label: 'Период', value: '28 дней' },
                    { label: 'Продукт', value: 'ПРАКТИКА' },
                ]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                <Card>
                    <BlockFrame block={practice} label="Воронка ПРАКТИКИ · от регистрации до оплаты" minHeight={220}>
                        {(d) => <Funnel data={d} slot="c1" />}
                    </BlockFrame>
                </Card>

                <Card>
                    <BlockFrame block={booking} label="Воронка записи на сессию" minHeight={200}>
                        {(d) => <Funnel data={d} slot="c3" height={32} />}
                    </BlockFrame>
                </Card>

                <Card>
                    <BlockFrame block={sources} label="Источники привлечения" minHeight={140}>
                        {(d) => <Sources data={d} />}
                    </BlockFrame>
                </Card>
            </ScreenBody>
        </>
    );
}

/**
 * Полосы воронки. Один тон с убывающей непрозрачностью: это величина,
 * а не идентичность, поэтому категориальных слотов здесь не нужно.
 */
function Funnel({ data, slot, height = 36 }: { data: FunnelData; slot: string; height?: number }) {
    const top = data.steps[0]?.value ?? 0;
    const opacities = [1, 0.85, 0.7, 0.55, 0.42];

    return (
        <>
            <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                {data.windowDays} дней · абсолют и доля от предыдущей ступени
            </div>
            {data.steps.map((step, i) => (
                <FunnelRow
                    key={step.key}
                    label={step.label}
                    value={num(step.value)}
                    ofPrevious={i === 0 ? '100 %' : `${dec(step.ofPrevious, 0)} %`}
                    width={top > 0 ? (step.value / top) * 100 : 0}
                    slot={slot}
                    opacity={opacities[Math.min(i, opacities.length - 1)]}
                    highlight={step.biggestDrop}
                    highlightLabel="главный отвал"
                    height={height}
                />
            ))}
            {/* Честный ноль верхней ступени: воронка вся нулевая не потому, что
                специалистов нет, а потому что окно (28 дней) уже, чем интервал
                между редкими регистрациями. Дата рядом — то самое число, которое
                объясняет ноль (B4). */}
            {top === 0 && data.lastRegisteredAt ? (
                <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                    последняя регистрация — {dateOf(data.lastRegisteredAt)} ({num(data.daysSinceLastRegistered ?? 0)} дн назад)
                </div>
            ) : null}
        </>
    );
}

/** Источники привлечения. Пустая привязка к аккаунту ≠ отсутствие источников (B5). */
function Sources({ data }: { data: SourcesData }) {
    if (data.totalLinked === 0) {
        return (
            <div style={{ fontSize: 13, color: 'var(--p-muted)', lineHeight: 1.5 }}>
                0 визитов привязано к аккаунту — связка появилась несколько дней
                назад и ещё не набралась.
                {data.visitsWithUtm > 0 ? (
                    <>
                        {' '}
                        Но {num(data.visitsWithUtm)} {plural(data.visitsWithUtm, 'визит', 'визита', 'визитов')} несут utm-метку — источники
                        известны, просто пока не с деньгами.
                    </>
                ) : null}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--p-muted)' }}>
                {num(data.totalLinked)} {plural(data.totalLinked, 'аккаунт', 'аккаунта', 'аккаунтов')} привязано к визиту (first-touch)
            </div>
            {data.sources.map((s) => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--p-muted)' }}>{s.source}</span>
                    <span className="p-mono" style={{ fontWeight: 600 }}>
                        {num(s.accounts)}
                    </span>
                </div>
            ))}
        </div>
    );
}
