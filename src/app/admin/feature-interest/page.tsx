import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Row = {
    feature: string;
    source: string;
    count: bigint;
    firstAt: Date;
    lastAt: Date;
};

const labels: Record<string, string> = {
    ai_notes_assistant: 'AI-помощник заметок',
    voice_transcription_summary: 'Голос → расшифровка/резюме',
    previous_notes_digest: 'Дайджест прошлых заметок',
    smart_slots: 'Умные слоты',
};

export default async function FeatureInterestPage() {
    let rows: Row[] = [];
    let error = '';

    try {
        rows = await db.$queryRaw<Row[]>`
            SELECT feature, source, COUNT(*)::bigint as count, MIN("createdAt") as "firstAt", MAX("createdAt") as "lastAt"
            FROM "FeatureInterest"
            GROUP BY feature, source
            ORDER BY COUNT(*) DESC, MAX("createdAt") DESC
        `;
    } catch (e: any) {
        error = e?.message || 'FeatureInterest table is unavailable';
    }

    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    const features = new Set(rows.map((row) => row.feature)).size;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#0f1729]">Интерес к будущим функциям</h1>
                <p className="text-[#64748b] text-sm mt-0.5">Клики “Хочу первым” из Android/web beta teaser.</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-mono">
                    DB error: {error}
                </div>
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Sparkles className="w-5 h-5 text-amber-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{total}</p><p className="text-xs text-[#94a3b8]">Всего заявок интереса</p></div>
                    </div>
                </CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Users className="w-5 h-5 text-indigo-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{features}</p><p className="text-xs text-[#94a3b8]">Функций с интересом</p></div>
                    </div>
                </CardContent></Card>
            </div>

            <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Функция</TableHead>
                                <TableHead>Источник</TableHead>
                                <TableHead className="text-right">Заявок</TableHead>
                                <TableHead>Первый клик</TableHead>
                                <TableHead>Последний клик</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-[#94a3b8]">Пока нет данных</TableCell></TableRow>
                            ) : rows.map((row) => (
                                <TableRow key={`${row.feature}:${row.source}`}>
                                    <TableCell className="font-medium text-[#0f1729]">{labels[row.feature] || row.feature}</TableCell>
                                    <TableCell><Badge variant="outline">{row.source}</Badge></TableCell>
                                    <TableCell className="text-right font-semibold">{Number(row.count)}</TableCell>
                                    <TableCell className="text-[#64748b] text-sm">{new Date(row.firstAt).toLocaleString('ru-RU')}</TableCell>
                                    <TableCell className="text-[#64748b] text-sm">{new Date(row.lastAt).toLocaleString('ru-RU')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
