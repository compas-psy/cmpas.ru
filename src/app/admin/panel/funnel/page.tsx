import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { FunnelData } from '@/lib/panel/queries/funnel';
import { ScreenBody, ScreenHeader } from '@/components/panel/chrome';
import { BlockFrame, Card } from '@/components/panel/block';
import { FunnelRow } from '@/components/panel/meters';
import { dec, num } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/** Экран 4 — «Путь и активация». */
export default async function FunnelScreen() {
    const { blocks, generatedAt } = await screen('funnel');

    const practice = pick<FunnelData>(blocks, 'practiceFunnel');
    const booking = pick<FunnelData>(blocks, 'bookingFunnel');
    const sources = pick<never>(blocks, 'sources');

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
                        {() => null}
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
        </>
    );
}
