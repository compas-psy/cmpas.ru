"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
    Cpu, HardDrive, MemoryStick, Activity, Database,
    Clock, Server, Wifi, RefreshCw, CheckCircle, XCircle,
} from 'lucide-react';

type HealthData = {
    cpu: { usage: number; count: number; model: string; loadAvg: number[] };
    memory: { total: number; used: number; free: number; usage: number };
    disk: { total: number; used: number; free: number; usage: number };
    database: { status: string; latency: number };
    process: { uptime: number; memoryRSS: number; memoryHeapUsed: number; memoryHeapTotal: number; nodeVersion: string; pid: number };
    system: { uptime: number; platform: string; hostname: string; arch: string };
    responseTime: number;
    timestamp: string;
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}д ${h}ч ${m}м`;
    if (h > 0) return `${h}ч ${m}м`;
    return `${m}м`;
}

function GaugeCard({
    title,
    value,
    max,
    unit,
    icon: Icon,
    details,
    color,
}: {
    title: string;
    value: number;
    max: number;
    unit: string;
    icon: any;
    details?: string;
    color: string;
}) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (pct / 100) * circumference;

    const getColor = (p: number) => {
        if (p < 60) return '#10b981';
        if (p < 80) return '#f59e0b';
        return '#ef4444';
    };

    const gaugeColor = getColor(pct);

    return (
        <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm text-[#0f1729]">{title}</h3>
                </div>

                <div className="flex items-center justify-center mb-4">
                    <div className="relative w-28 h-28">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                            <circle
                                cx="50" cy="50" r="42" fill="none"
                                stroke={gaugeColor}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                className="transition-all duration-700"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-[#0f1729]">{pct}</span>
                            <span className="text-[10px] text-[#94a3b8] font-medium">{unit}</span>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-[#94a3b8]">
                        {formatBytes(value)} / {formatBytes(max)}
                    </p>
                    {details && <p className="text-[10px] text-[#94a3b8] mt-1">{details}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

export default function HealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastFetch, setLastFetch] = useState<Date | null>(null);

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/admin/health', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setError('');
            setLastFetch(new Date());
        } catch (e: any) {
            setError(e.message || 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#0f1729]">Здоровье хостинга</h1>
                    <p className="text-[#64748b] text-sm mt-0.5">Загрузка метрик...</p>
                </div>
                <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="border-0 shadow-sm">
                            <CardContent className="p-6">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-4 bg-[#f1f5f9] rounded w-24" />
                                    <div className="h-28 bg-[#f1f5f9] rounded-full w-28 mx-auto" />
                                    <div className="h-3 bg-[#f1f5f9] rounded w-32 mx-auto" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-[#0f1729]">Здоровье хостинга</h1>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-8 text-center">
                        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                        <p className="text-red-600 font-medium">Ошибка: {error}</p>
                        <button
                            onClick={fetchHealth}
                            className="mt-4 px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
                        >
                            Повторить
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#0f1729]">Здоровье хостинга</h1>
                    <p className="text-[#64748b] text-sm mt-0.5">
                        Мониторинг ресурсов сервера в реальном времени
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastFetch && (
                        <span className="text-[10px] text-[#94a3b8]">
                            Обновлено: {lastFetch.toLocaleTimeString('ru-RU')}
                        </span>
                    )}
                    <button
                        onClick={fetchHealth}
                        className="p-2 rounded-lg hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#334155] transition-colors"
                        title="Обновить"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Gauges */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
                <GaugeCard
                    title="Процессор"
                    value={data.cpu.usage}
                    max={100}
                    unit="%"
                    icon={Cpu}
                    color="bg-indigo-500"
                    details={`${data.cpu.count} ядер · ${data.cpu.model.split(' ').slice(0, 3).join(' ')}`}
                />
                <GaugeCard
                    title="Оперативная память"
                    value={data.memory.used}
                    max={data.memory.total}
                    unit="%"
                    icon={MemoryStick}
                    color="bg-sky-500"
                    details={`Свободно: ${formatBytes(data.memory.free)}`}
                />
                <GaugeCard
                    title="Диск"
                    value={data.disk.used}
                    max={data.disk.total}
                    unit="%"
                    icon={HardDrive}
                    color="bg-amber-500"
                    details={data.disk.total > 0 ? `Свободно: ${formatBytes(data.disk.free)}` : 'Данные недоступны'}
                />
            </div>

            {/* Status Cards */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {/* Database */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.database.status === 'OK' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                <Database className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-[#94a3b8]">База данных</p>
                                <div className="flex items-center gap-1.5">
                                    {data.database.status === 'OK'
                                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                        : <XCircle className="w-3.5 h-3.5 text-red-500" />
                                    }
                                    <span className="text-sm font-semibold text-[#0f1729]">{data.database.status}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-[#94a3b8]">Latency: <strong className="text-[#334155]">{data.database.latency}ms</strong></p>
                    </CardContent>
                </Card>

                {/* Response Time */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-[#94a3b8]">Время ответа</p>
                                <p className="text-sm font-semibold text-[#0f1729]">{data.responseTime}ms</p>
                            </div>
                        </div>
                        <p className="text-xs text-[#94a3b8]">Node.js <strong className="text-[#334155]">{data.process.nodeVersion}</strong></p>
                    </CardContent>
                </Card>

                {/* Server Uptime */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-[#94a3b8]">Uptime ОС</p>
                                <p className="text-sm font-semibold text-[#0f1729]">{formatUptime(data.system.uptime)}</p>
                            </div>
                        </div>
                        <p className="text-xs text-[#94a3b8]">Процесс: <strong className="text-[#334155]">{formatUptime(data.process.uptime)}</strong></p>
                    </CardContent>
                </Card>

                {/* System Info */}
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                                <Server className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-[#94a3b8]">Система</p>
                                <p className="text-sm font-semibold text-[#0f1729]">{data.system.platform} ({data.system.arch})</p>
                            </div>
                        </div>
                        <p className="text-xs text-[#94a3b8]">Host: <strong className="text-[#334155]">{data.system.hostname}</strong></p>
                    </CardContent>
                </Card>
            </div>

            {/* Process Memory */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                    <h3 className="font-semibold text-sm text-[#0f1729] mb-4">Память процесса Node.js</h3>
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        <div className="p-4 rounded-xl bg-[#f8fafc]">
                            <p className="text-xs text-[#94a3b8] mb-1">RSS (Resident Set)</p>
                            <p className="text-lg font-bold text-[#0f1729]">{formatBytes(data.process.memoryRSS)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[#f8fafc]">
                            <p className="text-xs text-[#94a3b8] mb-1">Heap Used</p>
                            <p className="text-lg font-bold text-[#0f1729]">{formatBytes(data.process.memoryHeapUsed)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-[#f8fafc]">
                            <p className="text-xs text-[#94a3b8] mb-1">Heap Total</p>
                            <p className="text-lg font-bold text-[#0f1729]">{formatBytes(data.process.memoryHeapTotal)}</p>
                        </div>
                    </div>

                    {data.cpu.loadAvg[0] > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                            <p className="text-xs text-[#94a3b8] mb-2">Load Average (1m / 5m / 15m)</p>
                            <div className="flex gap-3">
                                {data.cpu.loadAvg.map((la, i) => (
                                    <span key={i} className="text-sm font-semibold text-[#334155] px-3 py-1 bg-[#f8fafc] rounded-lg">
                                        {la}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Auto-refresh indicator */}
            <div className="flex items-center justify-center gap-2 text-[10px] text-[#94a3b8]">
                <Wifi className="w-3 h-3" />
                <span>Автообновление каждые 30 секунд</span>
            </div>
        </div>
    );
}
