/**
 * Сборщики экранов: имя блока → `PanelBlock`.
 *
 * Каждый запрос обёрнут в `guard`, поэтому падение одного блока не роняет
 * экран — блок приходит в состоянии `broken` с причиной, остальные приходят
 * как есть (ТЗ §4).
 */

import { countHonestHoles, guard, type PanelBlock, type ScreenPayload } from '../types';
import { cachedScreen } from '../cache';
import type { ProductKey } from '../screens';

import * as morning from '../queries/morning';
import * as money from '../queries/money';
import * as products from '../queries/products';
import * as funnel from '../queries/funnel';
import * as retention from '../queries/retention';
import * as tech from '../queries/tech';
import * as quality from '../queries/quality';

export interface ScreenResult {
    blocks: ScreenPayload;
    /** Самое свежее время расчёта среди блоков — оно печатается в шапке. */
    generatedAt: string | null;
    honestHoles: number;
}

function finish(blocks: ScreenPayload): ScreenResult {
    const stamps = Object.values(blocks)
        .map((b) => b.generatedAt)
        .filter((v): v is string => Boolean(v))
        .sort();
    return {
        blocks,
        generatedAt: stamps[stamps.length - 1] ?? null,
        honestHoles: countHonestHoles(blocks),
    };
}

async function collect(entries: Record<string, () => Promise<PanelBlock<unknown>>>): Promise<ScreenResult> {
    const keys = Object.keys(entries);
    const values = await Promise.all(keys.map((key) => guard(key, entries[key])));
    const blocks: ScreenPayload = {};
    keys.forEach((key, i) => {
        blocks[key] = values[i];
    });
    return finish(blocks);
}

// ── Экран 1 — Утро ────────────────────────────────────────────────────────

async function buildMorning(): Promise<ScreenResult> {
    const base = await collect({
        sessionsWeekly: morning.qSessionsWeekly,
        lampMoney: morning.qLampMoney,
        lampSite: morning.qLampSite,
        lampDb: morning.qLampDb,
        lampBackup: morning.qLampBackup,
        lampReminders: morning.qLampReminders,
        lampApp: morning.qLampApp,
    });

    // «Требует вас» считается из уже полученных ламп, а не запрашивает их заново.
    const attention = await guard('q_attention', () =>
        morning.qAttention({
            money: base.blocks.lampMoney as never,
            site: base.blocks.lampSite as never,
            dbLamp: base.blocks.lampDb as never,
            backup: base.blocks.lampBackup as never,
            reminders: base.blocks.lampReminders as never,
        }),
    );

    return finish({ ...base.blocks, attention });
}

// ── Экран 2 — Деньги ──────────────────────────────────────────────────────

function buildMoney(): Promise<ScreenResult> {
    return collect({
        mrr: money.qMrrMonthly,
        payingUsers: money.qPayingUsers,
        arpu: money.qArpu,
        trialConversion: money.qTrialConversion,
        revenueChurn: money.qRevenueChurn,
        paymentsDaily: money.qPaymentsDaily,
        mrrWaterfall: money.qMrrWaterfall,
        failedQueue: money.qPaymentsFailedQueue,
        infraCost: tech.qInfraCost,
    });
}

// ── Экран 3 — Продукты ────────────────────────────────────────────────────

function buildProducts(product: ProductKey): Promise<ScreenResult> {
    if (product === 'zapiski') {
        return Promise.resolve(finish(products.zapiskiBlocks()));
    }
    if (product === 'momenty') {
        return collect({
            ...wrapStatic(products.momentyBlocks()),
            crossProduct: products.qCrossProduct,
        });
    }
    return collect({
        nsm: products.qPracticeNsm,
        active: products.qPracticeActive,
        activation: products.qPracticeActivation,
        reschedule: products.qPracticeReschedule,
        bookingAuthor: products.qPracticeBookingAuthor,
        reminders: products.qPracticeReminders,
    });
}

function wrapStatic(blocks: Record<string, PanelBlock<unknown>>): Record<string, () => Promise<PanelBlock<unknown>>> {
    const out: Record<string, () => Promise<PanelBlock<unknown>>> = {};
    for (const [key, block] of Object.entries(blocks)) out[key] = () => Promise.resolve(block);
    return out;
}

// ── Экран 4 — Путь и активация ────────────────────────────────────────────

function buildFunnel(): Promise<ScreenResult> {
    return collect({
        practiceFunnel: funnel.qFunnelPractice,
        bookingFunnel: funnel.qFunnelBooking,
        sources: funnel.qSources,
    });
}

// ── Экран 5 — Удержание ───────────────────────────────────────────────────

function buildRetention(): Promise<ScreenResult> {
    return collect({
        cohorts: retention.qCohortsPractice,
        momentyRetention: retention.qRetentionMomenty,
        churnCount: retention.qChurnCount,
        churnReasons: retention.qChurnReasons,
    });
}

// ── Экран 6 — Техника ─────────────────────────────────────────────────────

function buildTech(): Promise<ScreenResult> {
    return collect({
        server: tech.qTechServer,
        responseP95: tech.qTechResponseP95,
        database: tech.qTechDb,
        zapiskiStorage: tech.qTechZapiskiStorage,
        deploys: tech.qTechDeploys,
        backups: tech.qTechBackups,
        channels: tech.qTechChannels,
        appVersion: tech.qTechAppVersion,
        infraCost: tech.qInfraCost,
    });
}

// ── Экран 7 — Качество данных ─────────────────────────────────────────────

async function buildQuality(): Promise<ScreenResult> {
    const base = await collect({
        rejected: quality.qRejectedEvents,
        silence: quality.qEventSilence,
        sourceDiff: quality.qSourceDiff,
    });

    // Свежесть экранов считается по их собственным (кешированным) расчётам.
    const others = await Promise.all([
        screen('morning'),
        screen('money'),
        screen('products', 'practice'),
        screen('funnel'),
        screen('retention'),
        screen('tech'),
    ]);

    const titles = ['Утро', 'Деньги', 'Продукты', 'Путь и активация', 'Удержание', 'Техника'];
    const keys = ['morning', 'money', 'products', 'funnel', 'retention', 'tech'];

    const freshness = await guard('q_screen_freshness', () =>
        quality.qScreenFreshness(
            others.map((r, i) => ({ screen: keys[i], title: titles[i], generatedAt: r.generatedAt })),
        ),
    );

    const totalHoles = others.reduce((acc, r) => acc + r.honestHoles, 0) + base.honestHoles;
    const result = finish({ ...base.blocks, freshness });
    return { ...result, honestHoles: totalHoles };
}

// ── Кеш и публичный вход ──────────────────────────────────────────────────

const cachedMorning = cachedScreen('morning', [], buildMorning);
const cachedMoney = cachedScreen('money', [], buildMoney);
const cachedFunnel = cachedScreen('funnel', [], buildFunnel);
const cachedRetention = cachedScreen('retention', [], buildRetention);
const cachedTech = cachedScreen('tech', [], buildTech);
const cachedQuality = cachedScreen('quality', [], buildQuality);
const cachedProducts: Record<ProductKey, () => Promise<ScreenResult>> = {
    practice: cachedScreen('products', ['practice'], () => buildProducts('practice')),
    zapiski: cachedScreen('products', ['zapiski'], () => buildProducts('zapiski')),
    momenty: cachedScreen('products', ['momenty'], () => buildProducts('momenty')),
};

export function screen(key: 'morning' | 'money' | 'funnel' | 'retention' | 'tech' | 'quality'): Promise<ScreenResult>;
export function screen(key: 'products', product: ProductKey): Promise<ScreenResult>;
export function screen(key: string, product: ProductKey = 'practice'): Promise<ScreenResult> {
    switch (key) {
        case 'morning':
            return cachedMorning();
        case 'money':
            return cachedMoney();
        case 'products':
            return cachedProducts[product]();
        case 'funnel':
            return cachedFunnel();
        case 'retention':
            return cachedRetention();
        case 'tech':
            return cachedTech();
        case 'quality':
            return cachedQuality();
        default:
            throw new Error(`неизвестный экран панели: ${key}`);
    }
}

/**
 * Число «честных дыр» по всей панели — блоков в состоянии `no_data`.
 * Считается динамически: ссылка «Что мы не умеем измерять — N честных дыр»
 * не имеет права печатать зашитое число.
 */
export async function countAllHonestHoles(): Promise<number> {
    const all = await Promise.all([
        screen('morning'),
        screen('money'),
        screen('products', 'practice'),
        screen('products', 'zapiski'),
        screen('products', 'momenty'),
        screen('funnel'),
        screen('retention'),
        screen('tech'),
    ]);
    return all.reduce((acc, r) => acc + r.honestHoles, 0);
}
