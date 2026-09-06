import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Профессиональное соглашение — Compas',
    description: 'Профессиональное соглашение специалиста, использующего сервис Compas (cmpas.ru).',
};

export default function ProfessionalAgreementPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>

                <h1 className="text-3xl font-bold text-primary mb-2">Профессиональное соглашение</h1>

                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <p>
                        Профессиональное соглашение — отдельный документ, описывающий условия работы
                        специалиста с клиентами через сервис Compas: границы ответственности,
                        требования к квалификации и этические обязательства. Он готовится и будет
                        опубликован здесь до того, как согласие с ним станет обязательным условием
                        использования соответствующих функций.
                    </p>
                    <p>
                        До публикации этого документа принятие Профессионального соглашения нигде в
                        сервисе не требуется.
                    </p>
                </div>
            </div>
        </main>
    );
}
