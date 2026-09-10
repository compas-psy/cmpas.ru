import { getPublicChannelInvite, buildSmartChannelLink } from '@/lib/channel-binding';
import { ConnectClient } from './ConnectClient';
import { InviteProblem } from './InviteProblem';

export const dynamic = 'force-dynamic';

export default async function ConnectPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await getPublicChannelInvite(token);

    // ПОГАШЕННАЯ ССЫЛКА — НЕ «СТРАНИЦА НЕ НАЙДЕНА».
    //
    // Раньше здесь стоял notFound(), и клиент, открывший настоящую ссылку
    // второй раз, видел ровно то же, что при опечатке в адресе. 09.09.2026
    // так и вышло: специалист открыл ссылку сам, токен погас, клиент получил
    // «404» и написал «чего-то не грузится бот». Ни он, ни специалист из
    // этого экрана понять ничего не могли.
    //
    // Теперь причина называется, и у человека есть следующий шаг.
    if (invite.problem) return <InviteProblem problem={invite.problem} />;

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
