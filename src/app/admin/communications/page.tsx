'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    Send, Users, Clock, CreditCard, AlertTriangle, Tag, MessageSquare,
    Loader2, Check, Mail, Zap, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSegmentCount, sendMassCommunication, getAllTags } from '../actions/crm';

const SEGMENTS = [
    { key: 'all', label: 'Все пользователи', icon: Users, desc: 'Все зарегистрированные' },
    { key: 'trial_active', label: 'Активный триал', icon: Clock, desc: 'trialEndsAt > сейчас' },
    { key: 'trial_expiring_7d', label: 'Триал истекает (7 дн)', icon: AlertTriangle, desc: 'Триал заканчивается в ближайшие 7 дней' },
    { key: 'subscription_active', label: 'Подписка активна', icon: CreditCard, desc: 'Оплаченная подписка' },
    { key: 'subscription_expired', label: 'Нет доступа', icon: AlertTriangle, desc: 'Триал + подписка истекли' },
    { key: 'no_telegram', label: 'Без Telegram', icon: MessageSquare, desc: 'Не привязан Telegram' },
    { key: 'by_tag', label: 'По тегам', icon: Tag, desc: 'Выбор по тегам' },
];

type Channel = 'telegram' | 'max' | 'email';

export default function CommunicationsPage() {
    const [step, setStep] = useState(1);
    const [segment, setSegment] = useState('all');
    const [channel, setChannel] = useState<Channel>('telegram');
    const [content, setContent] = useState('');
    const [subject, setSubject] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [counts, setCounts] = useState({ total: 0, telegram: 0, max: 0, email: 0 });
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
    const [isPending, startTransition] = useTransition();

    // Load tags
    useEffect(() => {
        getAllTags().then(setAllTags).catch(() => {});
    }, []);

    // Load counts when segment changes
    useEffect(() => {
        startTransition(async () => {
            const c = await getSegmentCount(segment, segment === 'by_tag' ? selectedTags : undefined);
            setCounts(c);
        });
    }, [segment, selectedTags]);

    const handleSend = async () => {
        setSending(true);
        try {
            const res = await sendMassCommunication(
                segment, channel, content,
                channel === 'email' ? subject : undefined,
                segment === 'by_tag' ? selectedTags : undefined
            );
            setResult(res);
            toast.success(`Отправлено: ${res.sent}, ошибок: ${res.failed}`);
            setStep(4); // show result
        } catch (err: any) {
            toast.error(err.message || 'Ошибка отправки');
        }
        setSending(false);
    };

    const channelCount = channel === 'telegram' ? counts.telegram : channel === 'max' ? counts.max : counts.email;

    return (
        <div>
            <h1 className="text-2xl font-bold text-[#0f1729] mb-1">Массовые рассылки</h1>
            <p className="text-sm text-[#64748b] mb-8">Отправляйте сообщения пользователям по сегментам</p>

            {/* Progress Steps */}
            <div className="flex items-center gap-3 mb-8">
                {[
                    { n: 1, label: 'Аудитория' },
                    { n: 2, label: 'Канал' },
                    { n: 3, label: 'Сообщение' },
                ].map(s => (
                    <div key={s.n} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            step >= s.n ? 'bg-[#0f1729] text-white' : 'bg-gray-100 text-[#94a3b8]'
                        }`}>{step > s.n ? <Check className="w-4 h-4" /> : s.n}</div>
                        <span className={`text-sm font-medium ${step >= s.n ? 'text-[#0f1729]' : 'text-[#94a3b8]'}`}>{s.label}</span>
                        {s.n < 3 && <ChevronRight className="w-4 h-4 text-[#c4c9d2]" />}
                    </div>
                ))}
            </div>

            {/* Step 1: Audience */}
            {step === 1 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-[#0f1729] mb-4">Выберите аудиторию</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {SEGMENTS.map(seg => {
                            const Icon = seg.icon;
                            const isSelected = segment === seg.key;
                            return (
                                <button
                                    key={seg.key}
                                    onClick={() => setSegment(seg.key)}
                                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                        isSelected
                                            ? 'border-[#0f1729] bg-[#f8f9fb]'
                                            : 'border-gray-100 hover:border-gray-200'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? 'bg-[#0f1729] text-white' : 'bg-gray-50 text-[#64748b]'
                                    }`}>
                                        <Icon className="w-5 h-5" strokeWidth={1.8} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-[#0f1729]">{seg.label}</p>
                                        <p className="text-xs text-[#94a3b8]">{seg.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tag Selection */}
                    {segment === 'by_tag' && allTags.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm font-medium text-[#0f1729] mb-2">Выберите теги:</p>
                            <div className="flex flex-wrap gap-2">
                                {allTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => setSelectedTags(prev =>
                                            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                        )}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            selectedTags.includes(tag)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-[#64748b] border border-gray-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        #{tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                        <p className="text-sm text-[#64748b]">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                            Будет отправлено: <strong className="text-[#0f1729]">{counts.total}</strong> пользователям
                        </p>
                        <button
                            onClick={() => setStep(2)}
                            disabled={counts.total === 0}
                            className="px-6 py-2.5 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors disabled:opacity-50"
                        >
                            Далее
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Channel */}
            {step === 2 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-[#0f1729] mb-4">Выберите канал</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { key: 'telegram' as Channel, label: 'Telegram', icon: Send, count: counts.telegram, color: 'blue' },
                            { key: 'max' as Channel, label: 'MAX', icon: MessageSquare, count: counts.max, color: 'violet' },
                            { key: 'email' as Channel, label: 'Email', icon: Mail, count: counts.email, color: 'green' },
                        ].map(ch => {
                            const Icon = ch.icon;
                            const isSelected = channel === ch.key;
                            return (
                                <button
                                    key={ch.key}
                                    onClick={() => setChannel(ch.key)}
                                    className={`p-6 rounded-xl border-2 text-center transition-all ${
                                        isSelected ? 'border-[#0f1729] bg-[#f8f9fb]' : 'border-gray-100 hover:border-gray-200'
                                    }`}
                                >
                                    <Icon className={`w-8 h-8 mx-auto mb-3 ${isSelected ? 'text-[#0f1729]' : 'text-[#94a3b8]'}`} strokeWidth={1.5} />
                                    <p className="text-sm font-semibold text-[#0f1729]">{ch.label}</p>
                                    <p className="text-xs text-[#64748b] mt-1">{ch.count} получателей</p>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                        <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-[#64748b] hover:text-[#0f1729] transition-colors">← Назад</button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={channelCount === 0}
                            className="px-6 py-2.5 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors disabled:opacity-50"
                        >
                            Далее
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Message */}
            {step === 3 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-[#0f1729] mb-4">Составьте сообщение</h2>

                    {channel === 'email' && (
                        <div className="mb-4">
                            <label className="text-sm font-medium text-[#0f1729] mb-1.5 block">Тема письма</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="Тема..."
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="text-sm font-medium text-[#0f1729] mb-1.5 block">Сообщение</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={6}
                            placeholder="Текст сообщения..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <p className="text-xs text-[#94a3b8] mt-2">
                            Переменные: <code className="bg-gray-100 px-1 rounded">{'{'+'name}'}</code> <code className="bg-gray-100 px-1 rounded">{'{'+'email}'}</code> <code className="bg-gray-100 px-1 rounded">{'{'+'trialDaysLeft}'}</code>
                        </p>
                    </div>

                    {/* Preview */}
                    {content && (
                        <div className="p-4 bg-gray-50 rounded-xl mb-4">
                            <p className="text-xs font-medium text-[#94a3b8] mb-2">Превью (для «Иван»)</p>
                            <p className="text-sm text-[#0f1729] whitespace-pre-wrap">
                                {content.replace(/\{name\}/g, 'Иван').replace(/\{email\}/g, 'ivan@example.com').replace(/\{trialDaysLeft\}/g, '14')}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-[#64748b] hover:text-[#0f1729] transition-colors">← Назад</button>
                        <button
                            onClick={handleSend}
                            disabled={sending || !content.trim()}
                            className="px-6 py-2.5 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Отправить {channelCount} сообщени{channelCount === 1 ? 'е' : channelCount < 5 ? 'я' : 'й'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Result */}
            {step === 4 && result && (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-[#0f1729] mb-2">Рассылка завершена</h2>
                    <div className="flex items-center justify-center gap-6 mb-6">
                        <div>
                            <p className="text-3xl font-bold text-green-600">{result.sent}</p>
                            <p className="text-xs text-[#94a3b8]">отправлено</p>
                        </div>
                        {result.failed > 0 && (
                            <div>
                                <p className="text-3xl font-bold text-red-500">{result.failed}</p>
                                <p className="text-xs text-[#94a3b8]">ошибок</p>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => { setStep(1); setResult(null); setContent(''); setSubject(''); }}
                        className="px-6 py-2.5 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors"
                    >
                        Новая рассылка
                    </button>
                </div>
            )}
        </div>
    );
}
