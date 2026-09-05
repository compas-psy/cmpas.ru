'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import {
    dismissPracticeOnboarding,
    getPracticeOnboarding,
    markBookingLinkShared,
    type PracticeOnboardingState,
} from '@/lib/practice/onboarding';

/**
 * Две точки записи состояния онбординга (Задача 24). Обе — тонкие: они лишь
 * отвечают на вопрос «кто это», правила живут в общем ядре.
 */

async function getPsychologistId(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function readOnboardingState(): Promise<PracticeOnboardingState | null> {
    try {
        return await getPracticeOnboarding(await getPsychologistId());
    } catch (error) {
        console.error('readOnboardingState error:', error);
        return null;
    }
}

/**
 * Ссылкой ДЕЙСТВИТЕЛЬНО поделились.
 *
 * Вызывается только с успешного пути: скопировали, система приняла share,
 * показали QR. Не с открытия шторки и не с неудачной попытки — иначе шаг
 * закрывался бы тем, что человек передумал.
 */
export async function confirmBookingLinkShared(): Promise<PracticeOnboardingState | null> {
    try {
        const psychologistId = await getPsychologistId();
        await markBookingLinkShared(psychologistId);
        revalidatePath('/diary');
        return await getPracticeOnboarding(psychologistId);
    } catch (error) {
        console.error('confirmBookingLinkShared error:', error);
        return null;
    }
}

/** «Скрыть» — на сервере, поэтому и в вебе, и в приложении. */
export async function dismissOnboarding(): Promise<PracticeOnboardingState | null> {
    try {
        const psychologistId = await getPsychologistId();
        await dismissPracticeOnboarding(psychologistId);
        revalidatePath('/diary');
        return await getPracticeOnboarding(psychologistId);
    } catch (error) {
        console.error('dismissOnboarding error:', error);
        return null;
    }
}
