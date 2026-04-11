import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role;
    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const startTime = Date.now();

    // CPU usage
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    let cpuUsage = 0;
    for (const cpu of cpus) {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        cpuUsage += ((total - idle) / total) * 100;
    }
    cpuUsage = Math.round(cpuUsage / cpuCount);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    // Disk - try Linux first, then Windows
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    let diskUsage = 0;
    try {
        const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4}'");
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 3) {
            diskTotal = parseInt(parts[0]) || 0;
            diskUsed = parseInt(parts[1]) || 0;
            diskFree = parseInt(parts[2]) || 0;
            diskUsage = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
        }
    } catch {
        // Windows or df not available - use process.memoryUsage as fallback
        try {
            const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption /format:csv');
            const lines = stdout.trim().split('\n').filter(l => l.includes(','));
            if (lines.length > 1) {
                const parts = lines[1].split(',');
                if (parts.length >= 4) {
                    diskFree = parseInt(parts[2]) || 0;
                    diskTotal = parseInt(parts[3]) || 0;
                    diskUsed = diskTotal - diskFree;
                    diskUsage = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
                }
            }
        } catch {
            // Can't determine disk usage
        }
    }

    // DB health
    let dbStatus = 'OK';
    let dbLatency = 0;
    try {
        const dbStart = Date.now();
        await db.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - dbStart;
    } catch {
        dbStatus = 'ERROR';
    }

    // Process info
    const nodeUptime = process.uptime();
    const osUptime = os.uptime();
    const processMemory = process.memoryUsage();

    // Load averages (Linux/Mac only, [0,0,0] on Windows)
    const loadAvg = os.loadavg();

    return NextResponse.json({
        cpu: {
            usage: cpuUsage,
            count: cpuCount,
            model: cpus[0]?.model || 'Unknown',
            loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
        },
        memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            usage: memUsage,
        },
        disk: {
            total: diskTotal,
            used: diskUsed,
            free: diskFree,
            usage: diskUsage,
        },
        database: {
            status: dbStatus,
            latency: dbLatency,
        },
        process: {
            uptime: nodeUptime,
            memoryRSS: processMemory.rss,
            memoryHeapUsed: processMemory.heapUsed,
            memoryHeapTotal: processMemory.heapTotal,
            nodeVersion: process.version,
            pid: process.pid,
        },
        system: {
            uptime: osUptime,
            platform: os.platform(),
            hostname: os.hostname(),
            arch: os.arch(),
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
    });
}
