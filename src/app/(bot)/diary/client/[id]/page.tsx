import { redirect } from 'next/navigation';

/**
 * По этому адресу лежала раскладка-заглушка: выдуманный «Алексей Смирнов»,
 * «клиент с 12.10.2025», кнопка «Режим сессии». Настоящей карточки клиента
 * здесь никогда не было — она живёт на /diary/clients?clientId=<id>.
 *
 * Адрес остаётся рабочим, а не удаляется: на него могли сослаться извне, и
 * 404 вместо карточки — тоже не ответ. Переадресация ведёт туда, где карточка
 * действительно есть.
 */
export default async function ClientCardRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/diary/clients?clientId=${encodeURIComponent(id)}`);
}
