// B4: payment_initiated — POST /api/payments/create, в момент, когда у
// банка реально создана платёжная сессия (initPayment вернул success),
// раньше этого события быть не может (Payment.status ещё 'pending').

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const initPayment = vi.fn();
vi.mock('@/lib/tinkoff', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/tinkoff')>();
    return { ...actual, initPayment: (...args: unknown[]) => initPayment(...args) };
});

const track = vi.fn();
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

const paymentCreate = vi.fn();
const paymentUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        payment: {
            create: (...args: unknown[]) => paymentCreate(...args),
            update: (...args: unknown[]) => paymentUpdate(...args),
        },
    },
}));

function req(body: unknown): Request {
    return new Request('https://cmpas.ru/api/payments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    }) as unknown as Request;
}

describe('POST /api/payments/create — payment_initiated (B4)', () => {
    beforeEach(() => {
        vi.resetModules();
        auth.mockReset();
        initPayment.mockReset();
        track.mockReset().mockResolvedValue(undefined);
        paymentCreate.mockReset();
        paymentUpdate.mockReset();
    });

    it('успешный Init у банка — payment_initiated с account_id и правильными props', async () => {
        auth.mockResolvedValue({ user: { id: 'user_1' } });
        paymentCreate.mockResolvedValue({ id: 'pay_1', terminal: 'site' });
        paymentUpdate.mockResolvedValue({});
        initPayment.mockResolvedValue({ success: true, paymentId: 'tk_1', paymentUrl: 'https://pay.example/x' });

        const { POST } = await import('../src/app/api/payments/create/route');
        const res = await POST(req({ plan: 'practice', months: 1 }) as any);

        expect(res.status).toBe(200);
        expect(track).toHaveBeenCalledTimes(1);
        const [, input] = track.mock.calls[0];
        expect(input).toMatchObject({
            event: 'payment_initiated',
            product: 'practice',
            accountId: 'user_1',
            props: { terminal: 'site', plan: 'practice', months: 1 },
        });
    });

    it('банк отказал в Init — payment_initiated не отправляется (сессии не возникло)', async () => {
        auth.mockResolvedValue({ user: { id: 'user_1' } });
        paymentCreate.mockResolvedValue({ id: 'pay_1', terminal: 'site' });
        paymentUpdate.mockResolvedValue({});
        initPayment.mockResolvedValue({ success: false, errorMessage: 'boom' });

        const { POST } = await import('../src/app/api/payments/create/route');
        await POST(req({ plan: 'practice', months: 1 }) as any);

        expect(track).not.toHaveBeenCalled();
    });

    it('без сессии — 401, ни платёж, ни событие не создаются', async () => {
        auth.mockResolvedValue(null);
        const { POST } = await import('../src/app/api/payments/create/route');
        const res = await POST(req({ plan: 'practice' }) as any);
        expect(res.status).toBe(401);
        expect(track).not.toHaveBeenCalled();
        expect(paymentCreate).not.toHaveBeenCalled();
    });
});
