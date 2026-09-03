// Task 4 (PRAKTIKA MVP): LegalDocumentAcceptance rows are consent evidence.
// Before this fix, LegalDocumentAcceptance.document had onDelete: Cascade,
// so admin deleteLegalDoc(id) could silently destroy every acceptance
// record tied to that document — the exact opposite of "immutable/
// versioned evidence" the legal architecture requires. The schema relation
// is now onDelete: Restrict; this test locks in the app-level precheck that
// gives a clear refusal instead of a raw DB constraint error.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const legalDocumentAcceptanceCount = vi.fn();
const legalDocumentDelete = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        legalDocumentAcceptance: {
            count: (...args: unknown[]) => legalDocumentAcceptanceCount(...args),
        },
        legalDocument: {
            delete: (...args: unknown[]) => legalDocumentDelete(...args),
        },
    },
}));

describe('deleteLegalDoc — refuses to destroy consent evidence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        auth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    });

    it('refuses to delete a document that has recorded acceptances', async () => {
        legalDocumentAcceptanceCount.mockResolvedValue(3);
        const { deleteLegalDoc } = await import('../src/app/admin/(chrome)/legal/actions');

        const result = await deleteLegalDoc('doc-with-evidence');

        expect(result.success).toBe(false);
        expect(legalDocumentDelete).not.toHaveBeenCalled();
    });

    it('deletes a document with zero acceptances (nothing to lose)', async () => {
        legalDocumentAcceptanceCount.mockResolvedValue(0);
        legalDocumentDelete.mockResolvedValue({ id: 'doc-unused' });
        const { deleteLegalDoc } = await import('../src/app/admin/(chrome)/legal/actions');

        const result = await deleteLegalDoc('doc-unused');

        expect(result.success).toBe(true);
        expect(legalDocumentDelete).toHaveBeenCalledWith({ where: { id: 'doc-unused' } });
    });

    it('non-admin cannot delete at all, regardless of evidence', async () => {
        auth.mockResolvedValue({ user: { id: 'someone', role: 'USER' } });
        const { deleteLegalDoc } = await import('../src/app/admin/(chrome)/legal/actions');

        await expect(deleteLegalDoc('doc-x')).rejects.toThrow('Unauthorized');
        expect(legalDocumentDelete).not.toHaveBeenCalled();
    });
});
