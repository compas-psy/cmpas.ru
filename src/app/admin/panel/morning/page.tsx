import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { AttentionItem, LampData } from '@/lib/panel/types';
import type { SessionsWeekly } from '@/lib/panel/queries/morning';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card, CapsLabel, SourceLine } from '@/components/panel/block';
import { Lamp } from '@/components/panel/lamp';
import { AttentionRow, TrendPill } from '@/components/panel/stat';
import { Sparkline } from '@/components/panel/charts';
import { num, plural } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

/**
 * Экран 1 — «Утро».
 * Порядок жёсткий и не переставляется: главная метрика → состояние систем →
 * «требует вас». Это единственный экран, который смотрят каждый день.
 */
export default async function MorningScreen() {
    const { blocks, generatedAt } = await screen('morning');

    const sessions = pick<SessionsWeekly>(blocks, 'sessionsWeekly');
    const attention = pick<AttentionItem[]>(blocks, 'attention');

    const lamps = [
        { key: 'lampMoney', title: 'Деньги' },
        { key: 'lampSite', title: 'Сайт' },
        { key: 'lampDb', title: 'База' },
        { key: 'lampBackup', title: 'Бэкап' },
        { key: 'lampReminders', title: 'Рассылка' },
        { key: 'lampApp', title: 'Приложение' },
    ];

    return (
        <>
            <ScreenHeader
                screenNo={1}
                title="Утро"
                screenKey="morning"
                filters={[{ label: 'Период', value: 'сегодня и неделя' }]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                {/* 1. Главная метрика */}
                <Card radius={22} padding={22}>
                    <BlockFrame block={sessions} label="Главная метрика · сессии через систему" minHeight={120}>
                        {(data) => (
                            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                                        <span className="p-mono" style={{ fontSize: 'var(--hero)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }}>
                                            {num(data.current)}
                                        </span>
                                        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--p-muted)' }}>за неделю</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <TrendPill delta={data.delta} />
                                        <span style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>
                                            к прошлой неделе · было {num(data.previous)}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto', width: 240, maxWidth: '100%' }}>
                                    <Sparkline data={data.weeks} slot="c1" title="Сессии по неделям, 12 недель" />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--p-sub)' }}>
                                        <span>12 недель назад</span>
                                        <span className="p-mono" style={{ color: 'var(--p-muted)', fontWeight: 600 }}>
                                            {num(data.current)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </BlockFrame>
                </Card>

                {/* 2. Состояние систем */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <CapsLabel>Состояние систем</CapsLabel>
                    <Grid cols={6}>
                        {lamps.map(({ key, title }) => {
                            const block = pick<LampData>(blocks, key);
                            if ((block.state === 'ok' || block.state === 'stale') && block.data) {
                                return <Lamp key={key} title={block.data.label} state={block.data.lamp} detail={block.data.detail} href={block.data.href} />;
                            }
                            // Лампа без данных — «не проверено», а не «в порядке».
                            return (
                                <Lamp
                                    key={key}
                                    title={title}
                                    state={block.state === 'loading' ? 'loading' : 'unverified'}
                                    detail={block.reason ?? 'причина не указана'}
                                />
                            );
                        })}
                    </Grid>
                    <SourceLine source="q_lamp_money · q_lamp_site · q_lamp_db · q_lamp_backup · q_lamp_reminders · q_lamp_app" generatedAt={generatedAt} />
                </div>

                {/* 3. Требует вас */}
                <Card>
                    <BlockFrame block={attention} label="Требует вас" minHeight={80}>
                        {(items) =>
                            items.length === 0 ? (
                                <div style={{ padding: '18px 0', borderTop: '1px solid var(--p-border)', fontSize: 14, color: 'var(--p-muted)' }}>
                                    Ничего не требует вас прямо сейчас. Это измеренная пустота, а не отсутствие проверки: ни одна лампа
                                    выше не в том состоянии, которое поднимает пункт.
                                </div>
                            ) : (
                                <>
                                    <div className="p-mono" style={{ fontSize: 11, color: 'var(--p-sub)' }}>
                                        {items.length} {plural(items.length, 'пункт', 'пункта', 'пунктов')} · ~
                                        {items.reduce((acc, i) => acc + i.minutes, 0)} минут
                                    </div>
                                    {items.map((item, index) => (
                                        <AttentionRow
                                            key={item.id}
                                            title={item.title}
                                            consequence={item.consequence}
                                            minutes={item.minutes}
                                            lamp={item.lamp}
                                            action={item.action}
                                            primary={index === 0}
                                        />
                                    ))}
                                </>
                            )
                        }
                    </BlockFrame>
                </Card>
            </ScreenBody>
        </>
    );
}
