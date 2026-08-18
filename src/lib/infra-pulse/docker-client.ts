// Thin Docker Engine API client over the unix socket (O-260817-12). No
// docker CLI, no extra dependency — the Engine API is plain HTTP over a unix
// socket, and Node's http module talks to a unix socket natively via the
// `socketPath` option. Only ever issues GET requests: container list,
// inspect, and event history — nothing that creates, starts, stops, or
// removes anything, matching "сборщик ничего не меняет".

import http from 'http';

export interface DockerContainerSummary {
    Id: string;
    Names: string[];
    State: string; // "running" | "exited" | ...
}

export interface DockerContainerInspect {
    Id: string;
    Name: string;
    State: { Running: boolean; StartedAt: string; RestartCount: number };
}

function dockerGetRaw(socketPath: string, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = http.request({ socketPath, path, method: 'GET', headers: { host: 'localhost' } }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if ((res.statusCode ?? 0) >= 400) {
                    reject(new Error(`docker API ${path} -> ${res.statusCode}: ${body.slice(0, 200)}`));
                    return;
                }
                resolve(body);
            });
        });
        req.on('error', reject);
        req.setTimeout(10_000, () => req.destroy(new Error('docker API timeout')));
        req.end();
    });
}

async function dockerGet<T>(socketPath: string, path: string): Promise<T> {
    const body = await dockerGetRaw(socketPath, path);
    return JSON.parse(body) as T;
}

export async function listContainers(socketPath: string): Promise<DockerContainerSummary[]> {
    return dockerGet<DockerContainerSummary[]>(socketPath, '/containers/json?all=true');
}

export async function inspectContainer(socketPath: string, id: string): Promise<DockerContainerInspect> {
    return dockerGet<DockerContainerInspect>(socketPath, `/containers/${encodeURIComponent(id)}/json`);
}

/**
 * Restarts in the last 24h — RestartCount from inspect is lifetime, not
 * windowed, so this counts "restart" events from the daemon's own event
 * history instead (a real, queryable range, not a live stream). /events
 * returns newline-delimited JSON (one object per line), not a JSON array —
 * counted by parseDockerEventsNdjson so the parsing is unit-testable
 * without a socket.
 */
export async function restartsSince(socketPath: string, containerId: string, since: Date, until: Date = new Date()): Promise<number> {
    const sinceUnix = Math.floor(since.getTime() / 1000);
    const untilUnix = Math.floor(until.getTime() / 1000);
    const filters = encodeURIComponent(JSON.stringify({ container: [containerId], event: ['restart'] }));
    const body = await dockerGetRaw(socketPath, `/events?since=${sinceUnix}&until=${untilUnix}&filters=${filters}`);
    return parseDockerEventsNdjson(body);
}

/** Counts newline-delimited JSON event objects; blank lines (trailing newline) don't count. */
export function parseDockerEventsNdjson(body: string): number {
    return body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean).length;
}

export interface ContainerHealth {
    name: string;
    running: boolean;
    uptimeSeconds: number | null;
    restarts24h: number;
}

export async function collectContainerHealth(socketPath: string, now: Date = new Date()): Promise<ContainerHealth[]> {
    const summaries = await listContainers(socketPath);
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const results: ContainerHealth[] = [];
    for (const summary of summaries) {
        const inspect = await inspectContainer(socketPath, summary.Id);
        const restarts24h = await restartsSince(socketPath, summary.Id, since).catch(() => 0);
        const startedAt = Date.parse(inspect.State.StartedAt);
        results.push({
            name: inspect.Name.replace(/^\//, ''),
            running: inspect.State.Running,
            uptimeSeconds: inspect.State.Running && !Number.isNaN(startedAt) ? Math.max(0, Math.floor((now.getTime() - startedAt) / 1000)) : null,
            restarts24h,
        });
    }
    return results;
}
