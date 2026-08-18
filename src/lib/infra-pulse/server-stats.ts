// Server CPU/memory/disk (O-260817-12, TZ_management_dashboard.md §9). Read
// from a host filesystem mounted read-only into the collector container
// (/proc, /sys are not visible through the docker socket alone — this is an
// explicit extra grant beyond "docker socket + one SELECT user", named in
// the PR). Parsing is kept separate from the filesystem read so the parsers
// are testable with fixture text, no container needed.

export interface CpuSample {
    idle: number;
    total: number;
}

/** First line of /proc/stat: `cpu  user nice system idle iowait irq softirq steal guest guest_nice`. */
export function parseProcStatCpuLine(line: string): CpuSample {
    const parts = line.trim().split(/\s+/).slice(1).map(Number);
    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = parts;
    return { idle: idle + iowait, total: user + nice + system + idle + iowait + irq + softirq + steal };
}

/** CPU% busy between two samples of the same cumulative counters. */
export function cpuPercentBetween(a: CpuSample, b: CpuSample): number | null {
    const totalDelta = b.total - a.total;
    const idleDelta = b.idle - a.idle;
    if (totalDelta <= 0) return null;
    return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
}

export interface MemStats {
    usedBytes: number;
    totalBytes: number;
}

/** /proc/meminfo — MemTotal/MemAvailable, both reported in kB by the kernel. */
export function parseProcMeminfo(text: string): MemStats | null {
    const total = /^MemTotal:\s+(\d+)\s*kB/m.exec(text)?.[1];
    const available = /^MemAvailable:\s+(\d+)\s*kB/m.exec(text)?.[1];
    if (total === undefined || available === undefined) return null;
    const totalBytes = Number(total) * 1024;
    const availableBytes = Number(available) * 1024;
    return { totalBytes, usedBytes: Math.max(0, totalBytes - availableBytes) };
}

export interface DiskStats {
    usedBytes: number;
    totalBytes: number;
}

/** From Node's fs.statfsSync() result (blocks are in `bsize`-sized units). */
export function diskStatsFromStatfs(statfs: { bsize: number; blocks: number; bfree: number }): DiskStats {
    const totalBytes = statfs.bsize * statfs.blocks;
    const freeBytes = statfs.bsize * statfs.bfree;
    return { totalBytes, usedBytes: Math.max(0, totalBytes - freeBytes) };
}
