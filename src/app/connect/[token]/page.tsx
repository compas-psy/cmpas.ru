import { notFound } from 'next/navigation';
import { getPublicChannelInvite } from '@/lib/channel-binding';
import { ConnectClient } from './ConnectClient';

export const dynamic = 'force-dynamic';

export default async function ConnectPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await getPublicChannelInvite(token);
    if (!invite) notFound();

    return (
        <ConnectClient
            channel={invite.channel}
            directLink={invite.directLink}
            clientName={invite.clientName}
            psychologistName={invite.psychologistName}
        />
    );
}
