'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';

// Default feature flags with labels
const DEFAULT_FLAGS: Record<string, { label: string; category: string }> = {
  voice_notes: { label: 'Голосовые заметки', category: 'features' },
  ai_summary: { label: 'AI резюме сессий', category: 'features' },
  ai_tags: { label: 'AI предложение тегов', category: 'features' },
  ai_interventions: { label: 'AI рекомендации интервенций', category: 'features' },
  client_notes_sharing: { label: 'Отправка заметок клиенту', category: 'features' },
  diagnostics: { label: 'Диагностика (тесты)', category: 'features' },
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw new Error('Forbidden');
  return session.user.id;
}

export async function getFeatureFlags() {
  // Get all flags from DB
  const rows = await db.systemConfig.findMany({ where: { category: 'features' } });
  const flags: Record<string, { enabled: boolean; label: string }> = {};

  // Start with defaults
  for (const [key, info] of Object.entries(DEFAULT_FLAGS)) {
    const row = rows.find(r => r.key === key);
    flags[key] = {
      enabled: row ? row.value === 'true' : false,
      label: info.label,
    };
  }
  return flags;
}

export async function setFeatureFlag(key: string, enabled: boolean) {
  await requireAdmin();
  const info = DEFAULT_FLAGS[key];
  if (!info) throw new Error(`Unknown flag: ${key}`);

  await db.systemConfig.upsert({
    where: { key },
    create: { key, value: enabled ? 'true' : 'false', label: info.label, category: 'features' },
    update: { value: enabled ? 'true' : 'false' },
  });
  return { success: true };
}

// Quick check for a single flag (used by feature components)
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const row = await db.systemConfig.findUnique({ where: { key } });
  return row?.value === 'true';
}
