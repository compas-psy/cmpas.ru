// Certificate card (O-260817-12). Outbound TLS handshake to the public
// port, reading the peer certificate's `valid_to` — no docker socket, no DB
// access, no secret needed for this one; it's the same thing any external
// uptime monitor would do.

import tls from 'tls';

export function daysUntil(validTo: string, now: Date = new Date()): number {
    const expiry = new Date(validTo);
    return Math.floor((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function certDaysLeft(hostname: string, port = 443, timeoutMs = 10_000): Promise<number | null> {
    return new Promise((resolve) => {
        const socket = tls.connect({ host: hostname, port, servername: hostname, timeout: timeoutMs }, () => {
            const cert = socket.getPeerCertificate();
            socket.end();
            if (!cert || !cert.valid_to) {
                resolve(null);
                return;
            }
            resolve(daysUntil(cert.valid_to));
        });
        socket.on('error', () => resolve(null));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(null);
        });
    });
}
