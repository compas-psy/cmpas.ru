import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { HELP_TOPICS, getTopic } from '../content';

export function generateStaticParams() {
    return HELP_TOPICS.map(t => ({ slug: t.slug }));
}

export default async function HelpTopicPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const topic = getTopic(slug);
    if (!topic) notFound();

    const currentIndex = HELP_TOPICS.findIndex(t => t.slug === slug);
    const next = currentIndex >= 0 && currentIndex < HELP_TOPICS.length - 1 ? HELP_TOPICS[currentIndex + 1] : null;

    return (
        <article className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
            <header className="mb-6 pb-6 border-b border-border">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">{topic.title}</h2>
                <p className="text-sm text-muted-foreground mt-2">{topic.description}</p>
            </header>

            <div className="space-y-8">
                {topic.sections.map((section, i) => (
                    <section key={i}>
                        <h3 className="text-lg font-bold text-foreground mb-3">{section.heading}</h3>
                        {section.paragraphs?.map((p, j) => (
                            <p key={j} className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 last:mb-0">
                                {p}
                            </p>
                        ))}
                        {section.steps && (
                            <ol className="mt-4 space-y-3">
                                {section.steps.map((step, j) => (
                                    <li key={j} className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5">
                                            {j + 1}
                                        </span>
                                        <span className="text-sm md:text-base text-muted-foreground leading-relaxed">
                                            {step}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {section.tip && (
                            <div className="mt-4 flex gap-3 bg-accent/10 border border-accent/30 rounded-xl p-4">
                                <Lightbulb className="w-5 h-5 text-accent-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                                <p className="text-sm text-foreground leading-relaxed">{section.tip}</p>
                            </div>
                        )}
                    </section>
                ))}
            </div>

            {next && (
                <div className="mt-8 pt-6 border-t border-border">
                    <Link
                        href={`/diary/help/${next.slug}`}
                        className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all group"
                    >
                        <div>
                            <div className="text-xs text-muted-foreground font-medium">Дальше</div>
                            <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                                {next.title}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </Link>
                </div>
            )}
        </article>
    );
}
