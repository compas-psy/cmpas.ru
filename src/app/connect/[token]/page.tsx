import { notFound } from 'next/navigation';
import { getPublicChannelInvite, buildSmartChannelLink } from '@/lib/channel-binding';
import { ConnectClient } from './ConnectClient';

export const dynamic = 'force-dynamic';

export default async function ConnectPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await getPublicChannelInvite(token);
    if (!invite) notFound();

    return (
        <ConnectClient
            channel={invite.channel}
            smartLink={buildSmartChannelLink(token)}
            telegramLink={invite.directLinks.telegram}
            maxLink={invite.directLinks.max}
            clientName={invite.clientName}
            psychologistName={invite.psychologistName}
        />
    );
}
