import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendMaxMessage } from '@/lib/max-bot';
import { verifyClientActionToken } from '@/lib/client-workflow';
import { createNotification } from '@/lib/notifications';
import { revokeConsent } from '@/lib/booking/consent';

// Working revoke button for the client's own "Мои записи" page
// (legal/CLIENT_CONSENT_BASIS.md §3, CJM_booking_v2.md §7 point 4, O-260817-09).
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { clientId, psychologistId, clientToken, token } = body;
        const actionToken = clientToken || token;

        if (!clientId || !psychologistId || !actionToken) {
            return NextResponse.json({ error: 'Client ID, psychologist ID and token are required' }, { status: 403 });
        }

        const client = await db.diaryClient.findFirst({ where: { id: clientId, psychologistId } });
        if (!client) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!verifyClientActionToken(psychologistId, clientId, actionToken)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await revokeConsent(db, clientId);

        await createNotification({
            psychologistId,
            type: 'consent_revoked',
            title: `${client.name} отозвал(а) согласие на обработку данных`,
            subtitle: 'Новая самозапись для этого клиента недоступна, пока согласие не будет дано заново',
            clientId,
        });

        const psychologist = await db.user.findUnique({
            where: { id: psychologistId },
            select: { telegramChatId: true, maxChatId: true },
        });
        if (psychologist?.telegramChatId) {
            await sendTelegramMessage(
                psychologist.telegramChatId,
                `⚠️ <b>${client.name}</b> отозвал(а) согласие на обработку персональных данных.\n\nСамозапись для этого клиента через личную ссылку недоступна, пока он(а) не даст согласие заново. История записей не затронута.`,
                { parse_mode: 'HTML' }
            ).catch(e => console.error('Failed to notify psychologist about consent revoke (Telegram)', e));
        }
        if (psychologist?.maxChatId) {
            await sendMaxMessage(
                psychologist.maxChatId,
                `${client.name} отозвал(а) согласие на обработку персональных данных. Самозапись для этого клиента недоступна, пока согласие не будет дано заново.`
            ).catch(e => console.error('Failed to notify psychologist about consent revoke (MAX)', e));
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error revoking consent:', e);
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal Server Error' }, { status: 500 });
    }
}
