// @vitest-environment jsdom
//
// Task 4 (PRAKTIKA MVP): AdsConsentModal used to call
// toggleAdsConsent(userId, true) directly — a "use server" export taking a
// client-supplied userId as identity, callable directly by anyone who knows
// the action id, regardless of which component renders it. The fix routes
// through toggleAdsConsentForUser(), which derives identity from the
// session itself and takes no id argument at all. This test proves the
// modal's accept button no longer passes any id into the mutation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const toggleAdsConsentForUser = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
vi.mock('@/app/diary/actions/settings', () => ({ toggleAdsConsentForUser }));

import { AdsConsentModal } from '../AdsConsentModal';

describe('AdsConsentModal — accept never sends a userId into the mutation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();
    });

    it('calls toggleAdsConsentForUser with only the boolean — no identity argument', async () => {
        const { getByText } = render(<AdsConsentModal userId="psy-1" />);

        vi.advanceTimersByTime(2000);
        vi.useRealTimers();

        await waitFor(() => getByText('Да, получать материалы'));
        fireEvent.click(getByText('Да, получать материалы'));

        await waitFor(() => expect(toggleAdsConsentForUser).toHaveBeenCalledTimes(1));
        expect(toggleAdsConsentForUser).toHaveBeenCalledWith(true);
    });
});
