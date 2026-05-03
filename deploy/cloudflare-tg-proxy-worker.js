/**
 * Cloudflare Worker — Telegram Bot API Reverse Proxy
 * 
 * Deployment:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this code
 *   3. Deploy
 *   4. Set TELEGRAM_API_URL=https://your-worker-name.your-subdomain.workers.dev in server .env
 *   5. Redeploy the app
 * 
 * This worker proxies all requests to api.telegram.org
 * For servers where Telegram is blocked by IP (e.g., Russia-based hosting)
 */
export default {
    async fetch(request) {
        const url = new URL(request.url);
        
        // Rewrite URL to api.telegram.org
        const telegramUrl = `https://api.telegram.org${url.pathname}${url.search}`;
        
        // Clone the request with the new URL
        const modifiedRequest = new Request(telegramUrl, {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' ? request.body : undefined,
        });
        
        // Forward to Telegram API
        const response = await fetch(modifiedRequest);
        
        // Return response with CORS headers
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...Object.fromEntries(response.headers),
                'Access-Control-Allow-Origin': '*',
            },
        });
        
        return modifiedResponse;
    },
};
