import { ClientDocumentsManualPanel } from './ClientDocumentsManualPanel';

export default async function ClientDocumentsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = await params;
    return <ClientDocumentsManualPanel clientId={clientId} />;
}
