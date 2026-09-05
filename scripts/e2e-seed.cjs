// Задача 27: синтетическая практика для E2E и визуального аудита.
// Настоящих людей здесь нет: имена вымышленные, домен .invalid (RFC 2606).
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
function utcDay(offset) { const d = new Date(); d.setUTCHours(0,0,0,0); return new Date(d.getTime() + offset*DAY); }

async function main() {
  // ── два специалиста: A работает, B нужен для проверки чужого доступа
  const a = await db.user.create({ data: {
    id: 't27-psy-a', email: 'maria@task27.invalid', name: 'Мария Соколова-Преображенская',
    trialEndsAt: new Date(Date.now() + 90*DAY),
  }});
  const b = await db.user.create({ data: {
    id: 't27-psy-b', email: 'boris@task27.invalid', name: 'Борис Второй',
    trialEndsAt: new Date(Date.now() + 90*DAY),
  }});

  await db.psychologistSettings.create({ data: {
    psychologistId: a.id, fullName: 'Соколова-Преображенская Мария', timezone: 'Europe/Moscow',
    onboardingCompleted: false, scheduleMode: 'booking', defaultSessionDuration: 50,
    onlineSessionLink: 'https://meet.example.invalid/maria',
  }});
  await db.psychologistSettings.create({ data: { psychologistId: b.id, fullName: 'Второй Борис' } });

  await db.psychologistSlug.create({ data: { psychologistId: a.id, slug: 'maria-sokolova', slugCyrillic: 'мария-соколова' } });
  await db.psychologistSlug.create({ data: { psychologistId: b.id, slug: 'boris-vtoroy' } });

  // ── обязательные юридические документы и принятие их специалистом A
  for (const [type, code, version] of [
    ['TERMS','cmpas_terms','1.0'], ['PRIVACY','cmpas_privacy','1.0'],
    ['PROFESSIONAL','cmpas_professional','1.0'], ['PRACTICE','cmpas_practice_terms','1.0'],
  ]) {
    const doc = await db.legalDocument.create({ data: {
      type, code, version, url: `/legal/${type.toLowerCase()}`, isActive: true, publishedAt: new Date(),
    }});
    for (const u of [a, b]) {
      await db.legalDocumentAcceptance.create({ data: {
        userId: u.id, documentId: doc.id, documentType: type, documentVersion: version,
        documentCode: code, source: 'seed', acceptedAt: new Date(),
      }});
    }
  }

  // ── кабинет с длинным адресом (визуальный стресс-кейс)
  const office = await db.psychologistAddress.create({ data: {
    id: 't27-address-1', psychologistId: a.id, name: 'Кабинет на Петроградской',
    address: 'Санкт-Петербург, Каменноостровский проспект, дом 42, литера А, парадная 3, этаж 5, офис 512',
    isActive: true,
  }});
  await db.psychologistAddress.create({ data: {
    id: 't27-address-2', psychologistId: a.id, name: 'Второй кабинет', address: 'Москва, улица Правды, 24, офис 7',
  }});

  // ── расписание: онлайн утром и очно вечером в один и тот же день недели
  const online = await db.scheduleRule.create({ data: {
    id: 't27-rule-online', psychologistId: a.id, name: 'Онлайн, утро', format: 'online',
    duration: 50, breakDuration: 10, priority: 1,
  }});
  const offline = await db.scheduleRule.create({ data: {
    id: 't27-rule-office', psychologistId: a.id, name: 'Кабинет, вечер', format: 'offline',
    addressId: office.id, duration: 50, breakDuration: 10, priority: 2,
  }});
  for (let dow = 1; dow <= 5; dow++) {
    await db.availabilitySlot.create({ data: { psychologistId: a.id, dayOfWeek: dow, startTime: '09:00', endTime: '13:00', scheduleRuleId: online.id } });
    await db.availabilitySlot.create({ data: { psychologistId: a.id, dayOfWeek: dow, startTime: '17:00', endTime: '21:00', scheduleRuleId: offline.id } });
  }

  // ── клиенты: длинное ФИО, обычный, без согласия, архивный
  const c1 = await db.diaryClient.create({ data: {
    id: 't27-client-1', psychologistId: a.id, name: 'Анастасия Владимировна Ковалевская',
    phone: '+70000000001', email: 'client1@task27.invalid', status: 'active', consentDate: new Date(),
  }});
  const c2 = await db.diaryClient.create({ data: {
    id: 't27-client-2', psychologistId: a.id, name: 'Пётр Ильин', phone: '+70000000002', status: 'active', consentDate: new Date(),
  }});
  const c3 = await db.diaryClient.create({ data: {
    id: 't27-client-3', psychologistId: a.id, name: 'Клиент Без Согласия', phone: '+70000000003', status: 'active',
  }});
  await db.diaryClient.create({ data: { id: 't27-client-b', psychologistId: b.id, name: 'Клиент Бориса', status: 'active' } });

  // ── сессии
  const mk = (id, clientId, dayOffset, time, extra = {}) => db.diarySession.create({ data: {
    id, psychologistId: a.id, clientId, date: utcDay(dayOffset), time,
    endTime: String(Number(time.slice(0,2)) + 1).padStart(2,'0') + ':' + time.slice(3),
    duration: 50, format: 'online', status: 'confirmed', ...extra,
  }});
  await mk('t27-sess-today-1', c1.id, 0, '10:00');
  await mk('t27-sess-today-2', c2.id, 0, '18:00', { format: 'offline', addressId: office.id });
  await mk('t27-sess-today-3', c3.id, 0, '19:00', { format: 'offline', addressId: office.id });
  await mk('t27-sess-future', c1.id, 3, '11:00');
  // прошедшая без заметки и неоплаченная — два пункта «требует внимания»
  await mk('t27-sess-past-nonote', c1.id, -2, '12:00', { status: 'completed' });
  await mk('t27-sess-past-unpaid', c2.id, -3, '15:00', { status: 'completed', notes: 'Работали с тревогой.' });
  await db.$executeRawUnsafe(`UPDATE "DiarySession" SET "paymentStatus" = 'unpaid' WHERE id = 't27-sess-past-unpaid'`);
  await db.diarySession.create({ data: {
    id: 't27-sess-b', psychologistId: b.id, clientId: 't27-client-b', date: utcDay(1), time: '10:00',
    endTime: '10:50', duration: 50, format: 'online', status: 'confirmed',
  }});

  // ── блок времени (плотный день)
  await db.diaryBlock.create({ data: {
    psychologistId: a.id, date: utcDay(0), startTime: '14:00', endTime: '15:00', reason: 'Личное',
  }});

  // ── интеграция календаря (для экрана «Синхронизация»)
  await db.calendarIntegration.create({ data: {
    id: 't27-integration', psychologistId: a.id, provider: 'google', accountEmail: 'maria@task27.invalid',
    isActive: true, syncFrom: true,
  }});

  // ── аттестация оператора ПДн (Задача 5)
  //
  // Специалист подтверждает её один раз, и до этого перенос практики и
  // создание клиентов закрыты. Здесь она проставлена: сквозной прогон
  // проверяет сам перенос, а не барьер перед ним — барьер закрыт
  // tests/create-client-requires-attestation.test.ts.
  await db.practiceOperatorAttestation.create({ data: {
    id: 't27-attestation', psychologistId: a.id,
    attestationCode: 'practice_client_data_operator', wordingVersion: '2026-09-03', serviceId: 'practice',
  }});

  // ── сессии авторизации для обоих специалистов
  for (const [u, token] of [[a,'t27-session-a'],[b,'t27-session-b']]) {
    await db.session.create({ data: { sessionToken: token, userId: u.id, expires: new Date(Date.now() + 30*DAY) } });
  }

  // ── подписанные ссылки, которыми продукт пользуется в жизни
  //
  // Клиент попадает на перенос и отмену не по голому идентификатору, а по
  // ссылке из сообщения бота: она подписана и привязана к паре
  // (специалист, клиент, встреча, действие). Сквозной прогон должен ходить
  // ровно этим путём, иначе он проверяет не тот вход, который есть у людей.
  const { createHash } = require('crypto');
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  const GRACE = 48 * 60 * 60 * 1000;
  const actionToken = (psychologistId, clientId, sessionId, action, expiresAt) => {
    const payload = `${psychologistId}|${clientId}|${sessionId}|${action}|${expiresAt}`;
    const sig = createHash('sha256').update(`${payload}:${secret}`).digest('hex').slice(0, 32);
    return 'sat1_' + Buffer.from(`${payload}|${sig}`).toString('base64url');
  };
  const personalToken = (clientId, issuedAt = Date.now()) => {
    const expiresAt = issuedAt + 30 * 24 * 60 * 60 * 1000;
    const payload = `${clientId}.${expiresAt}`;
    const sig = createHash('sha256').update(`${payload}:${secret}`).digest('hex').slice(0, 32);
    return 'st1_' + Buffer.from(`${payload}.${sig}`).toString('base64url');
  };

  const future = await db.diarySession.findUnique({ where: { id: 't27-sess-future' } });
  const expiry = future.date.getTime() + GRACE;
  const tokens = {
    rescheduleSessionId: 't27-sess-future',
    rescheduleToken: actionToken(a.id, c1.id, 't27-sess-future', 'reschedule', expiry),
    cancelToken: actionToken(a.id, c1.id, 't27-sess-future', 'cancel', expiry),
    knownClientToken: personalToken(c1.id),
  };
  const out = process.env.E2E_TOKENS_FILE || '/tmp/t27/e2e-tokens.json';
  require('fs').mkdirSync(require('path').dirname(out), { recursive: true });
  require('fs').writeFileSync(out, JSON.stringify(tokens, null, 2));

  console.log('SEED OK; токены записаны в ' + out);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
