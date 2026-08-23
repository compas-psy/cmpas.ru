// q_tech_response_p95 (ТЗ_management_dashboard.md §5, экран 6): самое
// дешёвое, что даёт честное число без внешнего APM — сам процесс приложения
// меряет длительность запроса. Это proxy.ts, а не middleware.ts: в Next.js
// 16 middleware.ts — deprecated-путь (см.
// https://nextjs.org/docs/messages/middleware-to-proxy), а proxy.ts всегда
// выполняется в Node.js-рантайме (не в Edge), что здесь и нужно — буфер в
// response-time.ts это module-level массив внутри процесса, и он должен
// оставаться одним и тем же между запросами, а не обнуляться в отдельном
// per-request изоляте Edge-рантайма.
//
// Замер намеренно вынесен в after(): он планируется ПОСЛЕ того, как ответ
// уже ушёл клиенту, так что сам замер (и его цена) никогда не задерживает
// ответ пользователю.
import { NextResponse, after } from 'next/server';
import type { NextRequest } from 'next/server';
import { recordRequestDuration } from '@/lib/infra-pulse/response-time';

export function proxy(request: NextRequest) {
    const startedAt = Date.now();
    const response = NextResponse.next();
    after(() => {
        recordRequestDuration(Date.now() - startedAt);
    });
    return response;
}

// Статика (_next/static, _next/image, favicon) не отражает "время ответа
// приложения" и на реальном трафике на порядки превышает число настоящих
// хитов — без исключения буфер измерял бы в основном раздачу файлов, а не
// работу приложения.
export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
