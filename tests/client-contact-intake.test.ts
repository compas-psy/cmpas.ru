// Приём клиента по контакту, пересланному боту.
//
// Здесь проверяется не «код вызывается», а решения, которые продукт обязан
// принимать правильно: не заводить дубль, не перезаписывать заполненное,
// не обходить правовой гейт и не создавать карточку без подтверждения
// человека. Каждый тест сторожит одно такое решение.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const userFindUnique = vi.fn();
const diaryClientFindMany = vi.fn();
const diaryClientFindFirst = vi.fn();
const diaryClientCreate = vi.fn();
const diaryClientUpdate = vi.fn();
const attestationFindFirst = vi.fn();
const draftCreate = vi.fn();
const draftFindUnique = vi.fn();
const draftUpdate = vi.fn();
const draftDeleteMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
        diaryClient: {
            findMany: (...a: unknown[]) => diaryClientFindMany(...a),
            findFirst: (...a: unknown[]) => diaryClientFindFirst(...a),
            create: (...a: unknown[]) => diaryClientCreate(...a),
            update: (...a: unknown[]) => diaryClientUpdate(...a),
        },
        practiceOperatorAttestation: { findFirst: (...a: unknown[]) => attestationFindFirst(...a) },
        clientIntakeDraft: {
            create: (...a: unknown[]) => draftCreate(...a),
            findUnique: (...a: unknown[]) => draftFindUnique(...a),
            update: (...a: unknown[]) => draftUpdate(...a),
            deleteMany: (...a: unknown[]) => draftDeleteMany(...a),
        },
    },
}));

const {
    normalizeIncomingContact,
    previewContactIntake,
    commitContactIntake,
    expireContactIntakeDrafts,
} = await import('../src/lib/clients/contact-intake');

const TELEGRAM_CONTACT = {
    phone_number: '+7 916 123-45-67',
    first_name: 'Анна',
    last_name: 'Волкова',
    user_id: 555001,
};

const MAX_CONTACT = {
    vcf_info: ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Анна Волкова', 'TEL;TYPE=CELL:+79161234567', 'END:VCARD'].join('\r\n'),
    max_info: { user_id: 777002, first_name: 'Анна', last_name: 'Волкова', name: 'Анна Волкова', username: null },
};

beforeEach(() => {
    vi.clearAllMocks();
    attestationFindFirst.mockResolvedValue({ id: 'attestation-1' });
    userFindUnique.mockResolvedValue({ id: 'psy-1' });
    diaryClientFindMany.mockResolvedValue([]);
    draftCreate.mockImplementation(({ data }: never) => Promise.resolve({ id: 'draft-1', ...(data as object) }));
});

describe('normalizeIncomingContact — два мессенджера к одному виду', () => {
    it('Telegram: имя из двух полей, телефон нормализуется', () => {
        expect(normalizeIncomingContact('telegram', TELEGRAM_CONTACT)).toEqual({
            name: 'Анна Волкова',
            phone: '+79161234567',
        });
    });

    it('MAX: имя и телефон достаются из vCard', () => {
        expect(normalizeIncomingContact('max', MAX_CONTACT)).toEqual({
            name: 'Анна Волкова',
            phone: '+79161234567',
        });
    });

    it('MAX без разборчивого vCard — имя берётся из max_info, а не теряется', () => {
        const result = normalizeIncomingContact('max', { vcf_info: 'мусор', max_info: MAX_CONTACT.max_info });
        expect(result.name).toBe('Анна Волкова');
        expect(result.phone).toBeUndefined();
    });

    it('телефон в разных написаниях приводится к одному виду', () => {
        const viaEight = normalizeIncomingContact('telegram', { ...TELEGRAM_CONTACT, phone_number: '89161234567' });
        expect(viaEight.phone).toBe('+79161234567');
    });
});

describe('previewContactIntake — что бот решает до нажатия кнопки', () => {
    it('чужой человек: телефон не принадлежит ни одному специалисту → игнорируем', async () => {
        userFindUnique.mockResolvedValue(null);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '999', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('not_a_psychologist');
        expect(draftCreate).not.toHaveBeenCalled();
    });

    it('новый клиент: черновик заводится, карточка — НЕТ', async () => {
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('new');
        expect(draftCreate).toHaveBeenCalled();
        // Главное: до нажатия кнопки в базе клиентов ничего не появилось.
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('такой телефон уже есть → «уже есть», дубль не предлагается', async () => {
        diaryClientFindMany.mockResolvedValue([
            { id: 'client-1', name: 'Анна Волкова', phone: '+79161234567', email: null },
        ]);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('existing');
        expect(result.existingClient?.id).toBe('client-1');
        // Дополнять нечего: телефон в карточке уже стоит.
        expect(result.fillable).toEqual([]);
    });

    it('карточка есть, но без телефона → предлагаем дополнить', async () => {
        diaryClientFindMany.mockResolvedValue([
            { id: 'client-1', name: 'Анна Волкова', phone: null, email: null },
        ]);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        // Совпадение только по имени — это подсказка, а не решение
        // (matchClientIdentity), поэтому дубль всё равно не заводим молча.
        expect(result.kind).toBe('suggested');
        expect(result.fillable).toContain('phone');
    });

    it('то же имя, но ДРУГОЙ телефон → подсказка без дополнения, решает человек', async () => {
        // Совпадение имени — не личность: это может быть тёзка. Дополнять
        // тут нечего, телефон в карточке стоит свой, и перезаписывать его
        // нельзя ни при каких условиях.
        diaryClientFindMany.mockResolvedValue([
            { id: 'client-1', name: 'Анна Волкова', phone: '+79990001122', email: null },
        ]);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('suggested');
        expect(result.existingClient?.id).toBe('client-1');
        expect(result.fillable).toEqual([]);
    });

    it('две карточки с одним именем → выбирать за человека нельзя', async () => {
        diaryClientFindMany.mockResolvedValue([
            { id: 'client-1', name: 'Анна Волкова', phone: null, email: null },
            { id: 'client-2', name: 'Анна Волкова', phone: null, email: null },
        ]);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('conflict');
        expect(draftCreate).not.toHaveBeenCalled();
    });

    it('нет аттестации оператора ПДн → ни черновика, ни карточки', async () => {
        attestationFindFirst.mockResolvedValue(null);
        const result = await previewContactIntake({ source: 'telegram', senderChatId: '111', contact: TELEGRAM_CONTACT });
        expect(result.kind).toBe('attestation_required');
        expect(draftCreate).not.toHaveBeenCalled();
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('контакт без имени → называем, чего не хватает, и не даём завести', async () => {
        const result = await previewContactIntake({
            source: 'telegram',
            senderChatId: '111',
            contact: { phone_number: '+79161234567', first_name: '' },
        });
        expect(result.kind).toBe('incomplete');
        expect(result.missing).toContain('name');
        expect(draftCreate).not.toHaveBeenCalled();
    });

    it('контакт без телефона → тоже неполный', async () => {
        const result = await previewContactIntake({
            source: 'max',
            senderChatId: 'max_777002',
            contact: { vcf_info: 'BEGIN:VCARD\r\nFN:Без телефона\r\nEND:VCARD', max_info: MAX_CONTACT.max_info },
        });
        expect(result.kind).toBe('incomplete');
        expect(result.missing).toContain('phone');
    });
});

describe('commitContactIntake — что происходит по кнопке', () => {
    const FRESH_DRAFT = {
        id: 'draft-1',
        psychologistId: 'psy-1',
        source: 'telegram',
        name: 'Анна Волкова',
        phone: '+79161234567',
        existingClientId: null,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    it('создаёт карточку и гасит черновик', async () => {
        draftFindUnique.mockResolvedValue(FRESH_DRAFT);
        diaryClientCreate.mockResolvedValue({ id: 'client-new', name: 'Анна Волкова' });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'create' });
        expect(result.kind).toBe('created');
        expect(diaryClientCreate).toHaveBeenCalled();
        expect(draftUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) })
        );
    });

    it('повторное нажатие той же кнопки второй карточки НЕ создаёт', async () => {
        draftFindUnique.mockResolvedValue({ ...FRESH_DRAFT, usedAt: new Date() });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'create' });
        expect(result.kind).toBe('already_used');
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('истёкший черновик отклоняется', async () => {
        draftFindUnique.mockResolvedValue({ ...FRESH_DRAFT, expiresAt: new Date(Date.now() - 1000) });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'create' });
        expect(result.kind).toBe('expired');
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('чужой черновик не открывается по id', async () => {
        // Иначе, зная id, один специалист завёл бы карточку в практике другого.
        draftFindUnique.mockResolvedValue({ ...FRESH_DRAFT, psychologistId: 'psy-OTHER' });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'create' });
        expect(result.kind).toBe('not_found');
        expect(diaryClientCreate).not.toHaveBeenCalled();
    });

    it('дополнение заполняет пустое и НЕ трогает заполненное', async () => {
        draftFindUnique.mockResolvedValue({ ...FRESH_DRAFT, existingClientId: 'client-1' });
        diaryClientFindFirst.mockResolvedValue({ id: 'client-1', name: 'Анна', phone: null, email: 'a@b.invalid' });
        diaryClientUpdate.mockResolvedValue({ id: 'client-1' });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'fill' });
        expect(result.kind).toBe('filled');
        const data = diaryClientUpdate.mock.calls[0][0].data;
        expect(data).toEqual({ phone: '+79161234567' });
        // Имя и почта в карточке остались прежними — их не перезаписали.
        expect(data).not.toHaveProperty('name');
        expect(data).not.toHaveProperty('email');
    });

    it('дополнять нечего → карточку не трогаем вовсе', async () => {
        draftFindUnique.mockResolvedValue({ ...FRESH_DRAFT, existingClientId: 'client-1' });
        diaryClientFindFirst.mockResolvedValue({ id: 'client-1', name: 'Анна', phone: '+79161234567', email: null });
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'fill' });
        expect(result.kind).toBe('nothing_to_fill');
        expect(diaryClientUpdate).not.toHaveBeenCalled();
    });

    it('отмена гасит черновик и ничего не создаёт', async () => {
        draftFindUnique.mockResolvedValue(FRESH_DRAFT);
        const result = await commitContactIntake({ draftId: 'draft-1', psychologistId: 'psy-1', action: 'cancel' });
        expect(result.kind).toBe('cancelled');
        expect(diaryClientCreate).not.toHaveBeenCalled();
        expect(draftUpdate).toHaveBeenCalled();
    });
});

describe('expireContactIntakeDrafts — личное не лежит дольше нужного', () => {
    it('удаляет истёкшие черновики', async () => {
        draftDeleteMany.mockResolvedValue({ count: 3 });
        const removed = await expireContactIntakeDrafts();
        expect(removed).toBe(3);
        const where = draftDeleteMany.mock.calls[0][0].where;
        expect(where.expiresAt.lt).toBeInstanceOf(Date);
    });
});
