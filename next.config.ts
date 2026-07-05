/** @type {import('next').NextConfig} */

// Applied to every response. Deliberately does NOT include a restrictive
// Content-Security-Policy or a global X-Frame-Options: a strict script-src CSP
// tends to break Next.js inline bootstrap and the Telegram WebApp SDK, and the
// /bot/* MiniApp pages are meant to load inside Telegram/MAX. Frame protection
// is therefore scoped to the sensitive /diary and /admin app areas below.
const baseSecurityHeaders = [
  // Force HTTPS for two years incl. subdomains (served behind TLS reverse proxy).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Block MIME sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs (which can carry client/session tokens) in Referer.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Drop powerful features by default.
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=()' },
];

// Only the psychologist-facing app must not be framed (clickjacking on the
// diary/admin). MiniApp and public client pages stay framable.
const frameProtectedHeaders = [
  ...baseSecurityHeaders,
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
];

const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: baseSecurityHeaders },
      { source: '/diary/:path*', headers: frameProtectedHeaders },
      { source: '/admin/:path*', headers: frameProtectedHeaders },
    ];
  },
};

export default nextConfig;
