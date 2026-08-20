import { screen } from '@/lib/panel/build';
import { pick } from '@/lib/panel/types';
import type { BackupCard, ChannelsCard, DbCard, DeployCard, ServerCard } from '@/lib/panel/queries/tech';
import { ScreenBody, ScreenHeader, Grid } from '@/components/panel/chrome';
import { BlockFrame, Card, CapsLabel, StateGlyph } from '@/components/panel/block';
import { InsetTile, ThresholdBar } from '@/components/panel/meters';
import { BackupDrillForm } from '@/components/panel/manual-value';
import { bytes, dateOf, dec, duration, num, pct } from '@/lib/panel/format';
import { severityFor } from '@/lib/panel/thresholds';

export const dynamic = 'force-dynamic';

/** Экран 6 — «Техника». Всё читается из показаний коллектора и `DeployLog`. */
export default async function TechScreen() {
    const { blocks, generatedAt } = await screen('tech');

    return (
        <>
            <ScreenHeader
                screenNo={6}
                title="Техника"
                screenKey="tech"
                filters={[{ label: 'Период', value: '30 дней' }]}
                generatedAt={generatedAt}
            />
            <ScreenBody>
                <Grid cols={2} gap={12}>
                    <Card>
                        <BlockFrame block={pick<ServerCard>(blocks, 'server')} label="Сервер" minHeight={260}>
                            {(d) => <Server data={d} />}
                        </BlockFrame>
                        <BlockFrame block={pick<never>(blocks, 'responseP95')} label="Ответ 95-го процентиля" minHeight={70}>
                            {() => null}
                        </BlockFrame>
                    </Card>

                    <Card tone={driftTone(pick<DbCard>(blocks, 'database'))}>
                        <BlockFrame block={pick<DbCard>(blocks, 'database')} label="База данных" minHeight={260}>
                            {(d) => <Database data={d} />}
                        </BlockFrame>
                    </Card>

                    <Card>
                        <BlockFrame block={pick<never>(blocks, 'zapiskiStorage')} label="Хранилище ЗАПИСОК" minHeight={140}>
                            {() => null}
                        </BlockFrame>
                        <div style={{ fontSize: 11.5, color: 'var(--p-sub)', lineHeight: '16px' }}>
                            Даже когда приёмник появится, на панель попадёт только объём. Путь, имя, заголовок и число
                            заметок не попадут никогда: сервер хранит шифротекст.
                        </div>
                    </Card>

                    <Card>
                        <BlockFrame block={pick<DeployCard>(blocks, 'deploys')} label="Выкладки и целостность" minHeight={220}>
                            {(d) => <Deploys data={d} />}
                        </BlockFrame>
                    </Card>

                    <Card tone="serious">
                        <span id="backup" />
                        <BlockFrame block={pick<BackupCard>(blocks, 'backups')} label="Резервные копии" minHeight={240}>
                            {(d) => <Backups data={d} />}
                        </BlockFrame>
                    </Card>

                    <Card>
                        <BlockFrame block={pick<ChannelsCard>(blocks, 'channels')} label="Каналы и рассылка" minHeight={200}>
                            {(d) => <Channels data={d} />}
                        </BlockFrame>
                        <BlockFrame block={pick<never>(blocks, 'appVersion')} label="Версия приложения в магазине" minHeight={70}>
                            {() => null}
                        </BlockFrame>
                    </Card>
                </Grid>
            </ScreenBody>
        </>
    );
}

function driftTone(block: ReturnType<typeof pick<DbCard>>): 'plain' | 'broken' {
    return (block.data?.drift?.total ?? 0) > 0 ? 'broken' : 'plain';
}

function Server({ data }: { data: ServerCard }) {
    return (
        <>
            <Grid cols={2} gap={10}>
                <InsetTile label="Процессор">
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {data.cpuPercent === null ? '—' : `${dec(data.cpuPercent, 0)} %`}
                    </div>
                </InsetTile>
                <InsetTile label="Память">
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {bytes(data.memUsedBytes === null ? null : Number(data.memUsedBytes))}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>
                        из {bytes(data.memTotalBytes === null ? null : Number(data.memTotalBytes))}
                    </div>
                </InsetTile>
            </Grid>

            {data.diskFreePercent !== null ? (
                <ThresholdBar
                    thresholdKey="diskFree"
                    value={data.diskFreePercent}
                    label="свободно на диске"
                    valueLabel={`${pct(data.diskFreePercent)} · ${bytes(Number(data.diskTotalBytes) - Number(data.diskUsedBytes))}`}
                />
            ) : null}

            {data.containers ? (
                <div data-scroll-x>
                    <div style={{ minWidth: 300 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px 74px', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--p-sub)', paddingBottom: 6 }}>
                            <span>Контейнер</span>
                            <span>Аптайм</span>
                            <span>Рестарты</span>
                        </div>
                        {data.containers.map((c) => (
                            <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr 84px 74px', gap: 8, fontSize: 12.5, padding: '5px 0', borderTop: '1px solid var(--p-border)', color: c.restarts24h > 0 || !c.running ? 'var(--wa-fg)' : undefined }}>
                                <span>{c.name}</span>
                                <span className="p-mono">{c.running ? duration(c.uptimeSeconds / 3600) : 'не запущен'}</span>
                                <span className="p-mono">{num(c.restarts24h)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {data.certDaysLeft !== null ? (
                <div style={{ fontSize: 12.5, color: severityFor('certDaysLeft', data.certDaysLeft) === 'ok' ? 'var(--p-muted)' : 'var(--wa-fg)' }}>
                    Сертификат истекает через <span className="p-mono">{num(data.certDaysLeft)}</span> дн
                </div>
            ) : null}
        </>
    );
}

function Database({ data }: { data: DbCard }) {
    const drift = data.drift?.total ?? 0;
    return (
        <>
            <Grid cols={2} gap={10}>
                <InsetTile label="Размер базы">
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {bytes(data.sizeBytes === null ? null : Number(data.sizeBytes))}
                    </div>
                </InsetTile>
                <InsetTile label="Опорные таблицы">
                    <div className="p-mono" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                        {data.rowCounts
                            ? Object.entries(data.rowCounts).map(([name, count]) => (
                                  <div key={name}>
                                      {name} {num(count)}
                                  </div>
                              ))
                            : '—'}
                    </div>
                </InsetTile>
            </Grid>

            {/* Расхождение миграций: любое расхождение — «серьёзно», без градаций. */}
            <div
                style={{
                    background: drift > 0 ? 'var(--br-bg)' : 'var(--ok-bg)',
                    color: drift > 0 ? 'var(--br-fg)' : 'var(--ok-fg)',
                    borderRadius: 16,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <StateGlyph state={drift > 0 ? 'broken' : 'ok'} />
                    <CapsLabel color="currentColor">Журнал миграций</CapsLabel>
                </div>
                <div className="p-mono" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                    {num(drift)}
                </div>
                <div style={{ fontSize: 12.5 }}>
                    {drift > 0 ? 'миграции есть в репозитории, но не в базе' : 'репозиторий и база сходятся'}
                </div>
                <div className="p-mono" style={{ fontSize: 11.5, opacity: 0.85 }}>
                    в журнале: {num(data.migrationsApplied ?? 0)} · незавершённых: {num(data.migrationsUnfinished ?? 0)}
                </div>
                {drift > 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                        Расхождение больше нуля — всегда «серьёзно»: следующая выкладка упадёт молча.
                    </div>
                ) : null}
            </div>

            {data.topTables ? (
                <div>
                    <CapsLabel>Самые большие таблицы</CapsLabel>
                    {data.topTables.map((t) => (
                        <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderTop: '1px solid var(--p-border)' }}>
                            <span className="p-mono">{t.name}</span>
                            <span className="p-mono" style={{ fontWeight: 600 }}>
                                {bytes(t.bytes)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}
        </>
    );
}

const DEPLOY_RESULT_LABEL: Record<string, string> = {
    success: 'успешно',
    rolled_back: 'откачено',
    schema_guard_stopped: 'остановлено предохранителем',
    failed: 'упало',
};

function Deploys({ data }: { data: DeployCard }) {
    const buildSeverity = severityFor('buildMinutes', data.buildMinutesLeft);
    return (
        <>
            <Grid cols={3} gap={10}>
                <InsetTile label="За 30 дней">
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {num(data.total30d)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>откачено {num(data.rolledBack)}</div>
                </InsetTile>
                {/* Предотвращённая авария — это успех, а не сбой. */}
                <InsetTile label="Остановлено предохранителем" tone="ok">
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {num(data.guardStopped)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>аварий не случилось</div>
                </InsetTile>
                <InsetTile label="Упало" tone={data.failed > 0 ? 'warning' : 'inset'}>
                    <div className="p-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                        {num(data.failed)}
                    </div>
                </InsetTile>
            </Grid>

            <div style={{ marginLeft: 5, paddingLeft: 16, borderLeft: '2px solid var(--p-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.recent.map((d) => (
                    <div key={d.id} style={{ position: 'relative' }}>
                        <span
                            aria-hidden
                            style={{
                                position: 'absolute',
                                left: -22,
                                top: 4,
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: d.result === 'success' ? 'var(--ok-fg)' : d.result === 'schema_guard_stopped' ? 'var(--wa-fg)' : 'var(--se-fg)',
                                border: '2px solid var(--p-card)',
                            }}
                        />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {d.imageRef ?? 'выкладка'} · {DEPLOY_RESULT_LABEL[d.result] ?? d.result}
                        </div>
                        <div className="p-mono" style={{ fontSize: 11.5, color: 'var(--p-sub)' }}>
                            {dateOf(d.startedAt)}
                            {d.errorNote ? ` · ${d.errorNote}` : ''}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ fontSize: 12.5, color: buildSeverity && buildSeverity !== 'ok' ? 'var(--wa-fg)' : 'var(--p-muted)' }}>
                Минуты сборок ·{' '}
                {data.buildMinutesLeft === null ? (
                    <span>остаток не снимается коллектором</span>
                ) : (
                    <span className="p-mono">{num(data.buildMinutesLeft)} осталось</span>
                )}
            </div>
        </>
    );
}

function Backups({ data }: { data: BackupCard }) {
    return (
        <>
            {/* Пока учебного восстановления не было, карточка не может быть зелёной. */}
            <div style={{ background: data.drillAt ? 'var(--ok-bg)' : 'var(--se-bg)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <CapsLabel color={data.drillAt ? 'var(--ok-fg)' : 'var(--se-fg)'}>
                    Дней с последнего учебного восстановления
                </CapsLabel>
                <div className="p-mono" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: data.drillAt ? 'var(--ok-fg)' : 'var(--se-fg)' }}>
                    {data.drillAt ? num(Math.floor((Date.now() - new Date(data.drillAt).getTime()) / 86400000)) : 'никогда'}
                </div>
                {!data.drillAt ? (
                    <div style={{ fontSize: 12.5, color: 'var(--p-muted)' }}>
                        Пока это число не станет конечным, карточка не может быть зелёной ни при каких обстоятельствах:
                        копии, которые никто не разворачивал, — это файлы, а не бэкап.
                    </div>
                ) : null}
                <BackupDrillForm current={data.drillAt} />
            </div>

            {data.ageHours !== null ? (
                <ThresholdBar
                    thresholdKey="backupAgeHours"
                    value={data.ageHours}
                    max={72}
                    label="возраст последней копии"
                    valueLabel={duration(data.ageHours)}
                />
            ) : null}

            <Grid cols={2} gap={10}>
                <InsetTile label="Размер копии">
                    <div className="p-mono" style={{ fontSize: 18, fontWeight: 700 }}>
                        {bytes(data.sizeBytes === null ? null : Number(data.sizeBytes))}
                    </div>
                    {data.sizeRatioYesterday !== null ? (
                        <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>
                            {dec((data.sizeRatioYesterday - 1) * 100)} % ко вчерашней
                        </div>
                    ) : null}
                </InsetTile>
                <InsetTile label="Читается ли копия" tone={data.readable === true ? 'ok' : data.readable === false ? 'serious' : 'unverified'}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {data.readable === true ? 'Да, проверено' : data.readable === false ? 'Нет' : 'Не проверялось'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>по факту чтения, не по факту файла</div>
                </InsetTile>
            </Grid>
        </>
    );
}

function Channels({ data }: { data: ChannelsCard }) {
    const due = data.remindersDue;
    const sent = data.remindersSent;
    const rate = due && due > 0 && sent !== null ? (sent / due) * 100 : null;

    return (
        <>
            {due === null ? (
                <div style={{ border: '1px dashed var(--un-br)', background: 'var(--un-bg)', borderRadius: 14, padding: 13, fontSize: 12.5, color: 'var(--un-fg)' }}>
                    Журнал отправок не заведён — сверять «должны были уйти» не с чем.
                </div>
            ) : (
                <div style={{ background: 'var(--wa-bg)', borderRadius: 14, padding: 13 }}>
                    <CapsLabel color="var(--wa-fg)">Напоминания за сутки</CapsLabel>
                    <div style={{ display: 'flex', gap: 18, marginTop: 6, flexWrap: 'wrap' }}>
                        {[
                            { label: 'должны были уйти', value: due },
                            { label: 'ушли вовремя', value: sent ?? 0 },
                            { label: 'ушли дважды', value: data.remindersSentTwice ?? 0 },
                        ].map((c) => (
                            <div key={c.label}>
                                <div className="p-mono" style={{ fontSize: 24, fontWeight: 700 }}>
                                    {num(c.value)}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--p-muted)' }}>{c.label}</div>
                            </div>
                        ))}
                    </div>
                    {rate !== null ? (
                        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--wa-fg)', fontWeight: 600 }}>
                            {pct(rate)} · единственный показатель, где цель — ровно 100 %
                        </div>
                    ) : null}
                </div>
            )}

            <div>
                <CapsLabel>Вебхуки мессенджеров</CapsLabel>
                {data.webhooks ? (
                    ([
                        ['Telegram', data.webhooks.telegram],
                        ['MAX', data.webhooks.max],
                    ] as const).map(([name, value]) => (
                        <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr 74px 92px', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--p-border)' }}>
                            <span>{name}</span>
                            <span className="p-mono" style={{ color: value && severityFor('webhookErrorRate', value.rate) !== 'ok' ? 'var(--wa-fg)' : undefined }}>
                                {value ? `${dec(value.rate)} % ош.` : '—'}
                            </span>
                            <span className="p-mono" style={{ color: 'var(--p-sub)' }}>
                                {value ? dateOf(value.checkedAt) : 'нет замера'}
                            </span>
                        </div>
                    ))
                ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--un-fg)', marginTop: 6 }}>
                        Доля ошибок вебхуков коллектором пока не снимается.
                    </div>
                )}
            </div>
        </>
    );
}
