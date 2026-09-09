/**
 * Аватарка клиента для приложения: GET /api/mobile/clients/<id>/avatar
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ АДРЕС. Приложение строит все свои запросы от одного
 * настроенного адреса — BuildConfig.API_BASE_URL, а он равен
 * https://cmpas.ru/api/mobile/. Первая версия аватарок собирала ссылку как
 * «база + /api/clients/…» и получала
 * https://cmpas.ru/api/mobile/api/clients/…/avatar — адрес, которого не
 * существует. В приложении не грузилась НИ ОДНА фотография, и выглядело это
 * как «аватарки не работают», хотя веб-маршрут был исправен.
 *
 * Чинить это вычислением origin из базы было бы хуже: приёмочные сборки
 * подменяют API_BASE_URL, чтобы не ходить в боевые данные, и своя сборка
 * ссылки мимо базы однажды увела бы тестовый прогон на боевой сервер.
 */

import { NextRequest } from 'next/server';
import { serveClientAvatar } from '@/lib/clients/avatar-service';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    return serveClientAvatar(req, id);
}
