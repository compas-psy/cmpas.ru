import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Условия практики — Compas',
    description: 'Условия ведения практики через сервис Compas (cmpas.ru).',
};

export default function PracticeTermsPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>

                <h1 className="text-3xl font-bold text-primary mb-2">Условия практики</h1>

                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <p>
                        Условия практики — отдельный документ, описывающий обязательства специалиста
                        при ведении практики через сервис Compas: работу с данными клиентов, порядок
                        привлечения новых клиентов и правила самозаписи. Он готовится и будет
                        опубликован здесь до того, как согласие с ним станет обязательным условием
                        использования соответствующих функций.
                    </p>
                    <p>
                        До публикации этого документа принятие Условий практики нигде в сервисе не
                        требуется.
                    </p>
                </div>
            </div>
        </main>
    );
}
