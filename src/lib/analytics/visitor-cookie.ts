// Имя куки с FingerprintJS visitorId, вынесено в общий модуль, чтобы
// клиентская запись (src/hooks/useAnalytics.ts) и серверное чтение
// (src/auth.ts, задача B5) не могли разойтись на разных строковых
// литералах.
export const VISITOR_ID_COOKIE = 'cmpas_visitor_id';
