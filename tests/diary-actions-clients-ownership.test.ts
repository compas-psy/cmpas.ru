// PRAKTIKA MVP Task 1 (ownership hardening): updateClient/archiveClient/
// restoreClient/saveQuestionnaire/updateSessionNotes scoped mutation ONLY by
// `id`, so psychologist A could mutate — or in updateClient's case even
// silently re-parent to themself — a client/session belonging to
// psychologist B. IDs are not authorization.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const diaryClientFindFirst = vi.fn();
const diaryClientUpdate = vi.fn();
const diaryClientUpdateMany = vi.fn();
const diaryClientDeleteMany = vi.fn();
const diaryQuestionnaireUpsert = vi.fn();
const diarySessionFindFirst = vi.fn();
const diarySessionUpdate = vi.fn();
const executeRaw = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/db', () => ({
    db: {
        diaryClient: {
            findFirst: (...args: unknown[]) => diaryClientFindFirst(...args),
            update: (...args: unknown[]) => diaryClientUpdate(...args),
            updateMany: (...args: unknown[]) => diaryClientUpdateMany(...args),
            deleteMany: (...args: unknown[]) => diaryClientDeleteMany(...args),
            findMany: vi.fn().mockResolvedValue([]),
        },
        diaryQuestionnaire: {
            upsert: (...args: unknown[]) => diaryQuestionnaireUpsert(...args),
        },
        diarySession: {
            findFirst: (...args: unknown[]) => diarySessionFindFirst(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
        $executeRaw: (...args: unknown[]) => executeRaw(...args),
    },
}));

vi.mock('@/lib/calendar/google', () => ({ fetchGoogleCalendarEvents: vi.fn() }));
vi.mock('@/lib/calendar/yandex', () => ({ fetchYandexCalendarEvents: vi.fn() }));
vi.mock('@/lib/clients/extract-name', () => ({ aggregateCandidates: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({ clientBookingLink: vi.fn() }));
vi.mock('@/lib/booking/slug', () => ({ getPsychologistBookingUrl: vi.fn() }));

const {
    updateClient,
    archiveClient,
    restoreClient,
    saveQuestionnaire,
    updateSessionNotes,
    deleteClient,
} = await import('../src/app/diary/actions/clients');

describe('Task 1: клиентские actions скопированы по psychologistId', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy-a' } });
    });

    it('updateClient: психолог A не может изменить и не может переприсвоить себе клиента B', async () => {
        diaryClientFindFirst.mockResolvedValue(null); // клиент существует, но принадлежит psy-b

        await expect(updateClient('client-of-b', { name: 'Захвачено' })).rejects.toThrow('Клиент не найден');
        expect(diaryClientUpdate).not.toHaveBeenCalled();
    });

    it('archiveClient: психолог A не может архивировать клиента B', async () => {
        diaryClientFindFirst.mockResolvedValue(null);

        await expect(archiveClient('client-of-b')).rejects.toThrow('Клиент не найден');
        expect(diaryClientUpdate).not.toHaveBeenCalled();
        expect(diaryClientUpdateMany).not.toHaveBeenCalled();
    });

    it('restoreClient: психолог A не может восстановить клиента B', async () => {
        diaryClientFindFirst.mockResolvedValue(null);

        await expect(restoreClient('client-of-b')).rejects.toThrow('Клиент не найден');
        expect(diaryClientUpdate).not.toHaveBeenCalled();
    });

    it('saveQuestionnaire: психолог A не может писать анкету клиенту B', async () => {
        diaryClientFindFirst.mockResolvedValue(null);

        await expect(saveQuestionnaire('client-of-b', { fullName: 'x' })).rejects.toThrow('Клиент не найден');
        expect(diaryQuestionnaireUpsert).not.toHaveBeenCalled();
    });

    it('updateSessionNotes: психолог A не может писать заметки в сессию психолога B', async () => {
        diarySessionFindFirst.mockResolvedValue(null);

        await expect(updateSessionNotes('session-of-b', 'текст')).rejects.toThrow('Сессия не найдена');
        expect(diarySessionUpdate).not.toHaveBeenCalled();
    });

    it('updateClient: свой клиент обновляется как раньше', async () => {
        diaryClientFindFirst.mockResolvedValue({ id: 'client-1' });
        diaryClientUpdate.mockResolvedValue({ id: 'client-1', name: 'Обновлено' });

        const result = await updateClient('client-1', { name: 'Обновлено' });

        expect(result).toEqual({ id: 'client-1', name: 'Обновлено' });
        expect(diaryClientUpdate).toHaveBeenCalledWith({
            where: { id: 'client-1' },
            data: { name: 'Обновлено', psychologistId: 'psy-a' },
        });
    });

    it('deleteClient: уже был корректно scoped через deleteMany({id, psychologistId})', async () => {
        await deleteClient('client-1');
        expect(diaryClientDeleteMany).toHaveBeenCalledWith({ where: { id: 'client-1', psychologistId: 'psy-a' } });
    });
});
