// Задача 25 §8: «требует внимания» закрывается делом, а не открытием.
//
// Соблазн здесь очевидный: повесить событие на нажатие кнопки. Тогда цифра
// показывала бы, сколько раз человек ткнул в карточку, и выглядела бы
// прекрасно ровно в той мере, в какой неверна: открыть карточку сессии,
// посмотреть и уйти, не написав ни слова, — обычное дело.
//
// Поэтому событие рождается из ПЕРЕХОДА: было «нет заметки» — стало «есть»,
// было unpaid — стало не unpaid, не было согласия — записано. Наружу уходит
// только вид проблемы: ни sessionId, ни clientId.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectRegistryClean, eventsNamed, type CapturedEvent } from './fixtures/analytics-capture';

const world = vi.hoisted(() => ({
    captured: [] as CapturedEvent[],
    noteBefore: { notes: null, clientSummary: null, structuredNotes: null } as Record<string, unknown>,
    noteAfter: { notes: null, clientSummary: null, structuredNotes: null } as Record<string, unknown>,
    paymentRow: { id: 'sess-1', clientId: 'cl-1', clientName: 'Анна Волкова', paymentStatus: 'unpaid' } as Record<string, unknown>,
}));

vi.mock('@/lib/analytics/track', () => ({
    track: vi.fn(async (_db: unknown, input: CapturedEvent) => { world.captured.push(input); }),
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(async () => undefined) }));

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findFirst: vi.fn(async () => world.noteBefore),
            update: vi.fn(async () => world.noteAfter),
        },
        $queryRaw: vi.fn(async () => [world.paymentRow]),
        $executeRaw: vi.fn(async () => 1),
    },
}));

const { observeNotesFilled, observePaymentSettled, observeConsentRecorded } = await import('@/lib/practice/attention-completion');
const noteActions = await import('@/app/diary/actions/note-actions');
const paymentRoute = await import('@/app/api/diary/sessions/[id]/payment/route');

const NOTHING = { notes: null, clientSummary: null, structuredNotes: null };
const SOMETHING = { notes: 'Работали с тревогой', clientSummary: null, structuredNotes: null };

beforeEach(() => {
    world.captured = [];
    world.noteBefore = { ...NOTHING };
    world.noteAfter = { ...NOTHING };
    world.paymentRow = { id: 'sess-1', clientId: 'cl-1', clientName: 'Анна Волкова', paymentStatus: 'unpaid' };
});

describe('заметка по сессии', () => {
    it('заметка появилась там, где её не было — проблема закрыта', async () => {
        await observeNotesFilled('psy-1', NOTHING, SOMETHING);

        const [done] = eventsNamed(world.captured, 'practice_attention_action_completed');
        expect(done.props).toEqual({ source: 'session_without_notes' });
        expectRegistryClean(world.captured);
    });

    it('открыл форму и сохранил пустое — ничего не закрылось', async () => {
        await observeNotesFilled('psy-1', NOTHING, { notes: '   ', clientSummary: '', structuredNotes: null });

        expect(world.captured).toEqual([]);
    });

    it('поправил уже написанную заметку — это не закрытие: закрыто было раньше', async () => {
        await observeNotesFilled('psy-1', SOMETHING, { ...SOMETHING, notes: 'Работали с тревогой и сном' });

        expect(world.captured).toEqual([]);
    });

    it('настоящее сохранение в вебе доводит событие до аналитики один раз', async () => {
        world.noteAfter = { ...SOMETHING };

        await noteActions.saveSessionNotes('sess-1', { notes: 'Работали с тревогой' });

        expect(eventsNamed(world.captured, 'practice_attention_action_completed')).toHaveLength(1);
    });

    it('текст заметки в событие не попадает', async () => {
        world.noteAfter = { notes: 'Клиент Анна Волкова, тел. +7 999 123-45-67', clientSummary: null, structuredNotes: null };

        await noteActions.saveSessionNotes('sess-1', { notes: String(world.noteAfter.notes) });

        const dump = JSON.stringify(world.captured);
        expect(dump).not.toContain('Волкова');
        expect(dump).not.toContain('999');
        expect(dump).not.toContain('sess-1');
    });
});

describe('отметка оплаты', () => {
    it('ушла из unpaid — проблема закрыта', async () => {
        await observePaymentSettled('psy-1', 'unpaid', 'paid');

        const [done] = eventsNamed(world.captured, 'practice_attention_action_completed');
        expect(done.props).toEqual({ source: 'session_unpaid' });
    });

    it('«оплачено» у уже оплаченной ничего не закрывает', async () => {
        await observePaymentSettled('psy-1', 'paid', 'paid');

        expect(world.captured).toEqual([]);
    });

    it('«оплата не требуется» — тоже закрытие: в списке остаются только unpaid', async () => {
        await observePaymentSettled('psy-1', 'unpaid', 'not_required');

        expect(eventsNamed(world.captured, 'practice_attention_action_completed')).toHaveLength(1);
    });

    it('повторное «не оплачено» проблему не закрывает', async () => {
        await observePaymentSettled('psy-1', 'unpaid', 'unpaid');

        expect(world.captured).toEqual([]);
    });

    it('настоящая отметка через веб-ресурс доходит до аналитики без имени клиента', async () => {
        const res = await paymentRoute.PATCH(
            { json: async () => ({ paymentStatus: 'paid' }) } as never,
            { params: Promise.resolve({ id: 'sess-1' }) },
        );

        expect(res.status).toBe(200);
        expect(eventsNamed(world.captured, 'practice_attention_action_completed')).toHaveLength(1);
        expect(JSON.stringify(world.captured)).not.toContain('Волкова');
        expectRegistryClean(world.captured);
    });

    it('через тот же ресурс, но без перехода — события нет', async () => {
        world.paymentRow.paymentStatus = 'paid';

        await paymentRoute.PATCH(
            { json: async () => ({ paymentStatus: 'paid' }) } as never,
            { params: Promise.resolve({ id: 'sess-1' }) },
        );

        expect(world.captured).toEqual([]);
    });
});

describe('согласие клиента', () => {
    it('согласие записано впервые — проблема закрыта', async () => {
        await observeConsentRecorded('psy-1', null);

        const [done] = eventsNamed(world.captured, 'practice_attention_action_completed');
        expect(done.props).toEqual({ source: 'client_without_consent' });
        expectRegistryClean(world.captured);
    });

    it('клиент соглашался раньше — новой версией проблему не закрыть: её не было', async () => {
        await observeConsentRecorded('psy-1', new Date('2026-01-01T00:00:00.000Z'));

        expect(world.captured).toEqual([]);
    });

    it('во всех трёх случаях наружу уходит только вид проблемы', async () => {
        await observeNotesFilled('psy-1', NOTHING, SOMETHING);
        await observePaymentSettled('psy-1', 'unpaid', 'paid');
        await observeConsentRecorded('psy-1', null);

        for (const captured of world.captured) {
            expect(Object.keys(captured.props)).toEqual(['source']);
        }
        expect(world.captured.map((e) => e.props.source)).toEqual([
            'session_without_notes', 'session_unpaid', 'client_without_consent',
        ]);
        expectRegistryClean(world.captured);
    });
});
