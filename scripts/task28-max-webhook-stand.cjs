/**
 * Задача 28, §6: приёмник MAX на СТЕНДЕ — приёмка по следствию, а не по коду.
 *
 * Почему нельзя по коду ответа: приёмник намеренно отвечает 200 и принятому
 * обновлению, и отвергнутому (src/app/api/max/webhook/route.ts). Иначе по
 * реакции можно было бы подбирать секрет, да и MAX на 200 не шлёт повторов.
 * Значит «принято» и «отвергнуто» различимы только последствием: привязался
 * клиент к каналу или нет.
 *
 * Прогон делает ровно три вещи, все на одноразовом стенде:
 *   1) отправляет bot_started БЕЗ секрета            → привязки быть не должно;
 *   2) отправляет bot_started с НЕВЕРНЫМ секретом    → привязки быть не должно;
 *   3) отправляет тот же bot_started с ВЕРНЫМ секретом → клиент привязан.
 *
 * Настоящему человеку при этом ничего не уходит: MAX_BOT_TOKEN стенду не
 * выдаётся, исходящая отправка падает и на поведение приёмника не влияет.
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');

const BASE = process.env.TASK28_BASE_URL || 'http://localhost:3100';
const SECRET = process.env.MAX_WEBHOOK_SECRET;
const db = new PrismaClient();

let failures = 0;
const ok = (m) => console.log(`  OK: ${m}`);
const bad = (m) => { console.log(`  ПРОВАЛ: ${m}`); failures += 1; };

async function post(headers, body) {
    const res = await fetch(`${BASE}/api/max/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    return { status: res.status, text: (await res.text()).slice(0, 120) };
}

(async () => {
    if (!SECRET) {
        console.log('MAX_WEBHOOK_SECRET не задан стенду — проверка невозможна');
        process.exit(2);
    }

    // Свой клиент и своё приглашение: чужого мы не трогаем.
    const psychologistId = 't27-psy-a';
    const clientId = `t28-max-${Date.now()}`;
    const token = crypto.randomBytes(16).toString('hex');
    const maxUserId = 900000000 + Math.floor(Math.random() * 1000000);

    await db.diaryClient.create({
        data: { id: clientId, psychologistId, name: 'Клиент Приёмника MAX', status: 'active' },
    });
    await db.clientInviteToken.create({
        data: {
            psychologistId,
            clientId,
            token,
            channel: 'max',
            expiresAt: new Date(Date.now() + 3600 * 1000),
        },
    });

    const update = {
        update_type: 'bot_started',
        payload: `c_${token}`,
        user: { user_id: maxUserId },
    };

    const bound = async () => {
        const row = await db.diaryClient.findUnique({ where: { id: clientId }, select: { maxChatId: true } });
        return row?.maxChatId ?? null;
    };

    try {
        console.log('1. без секретного заголовка');
        const r1 = await post({}, update);
        console.log(`   ответ: ${r1.status} ${r1.text}`);
        if (await bound()) bad('клиент привязался без секрета'); else ok('привязки нет');

        console.log('2. с неверным секретом');
        const r2 = await post({ 'X-Max-Bot-Api-Secret': 'task28-deliberately-wrong-secret' }, update);
        console.log(`   ответ: ${r2.status} ${r2.text}`);
        if (await bound()) bad('клиент привязался по неверному секрету'); else ok('привязки нет');

        if (r1.status !== r2.status || r1.text !== r2.text) {
            bad('ответы на «без секрета» и «неверный секрет» различаются — приёмник подсказывает подбирающему');
        } else {
            ok('оба отказа отвечают одинаково — подобрать секрет по реакции нельзя');
        }

        console.log('3. с верным секретом');
        const r3 = await post({ 'X-Max-Bot-Api-Secret': SECRET }, update);
        console.log(`   ответ: ${r3.status} ${r3.text}`);
        const chat = await bound();
        // Продукт хранит канал с приставкой канала («max_<id>»), а не голым
        // числом: один и тот же идентификатор в разных мессенджерах — разные
        // люди, и склеивать их нельзя.
        if (chat && String(chat).includes(String(maxUserId))) {
            ok('клиент привязан — верный секрет принят');
        } else {
            bad(`привязки нет даже с верным секретом (maxChatId=${chat})`);
        }
    } finally {
        await db.clientInviteToken.deleteMany({ where: { clientId } });
        await db.diaryClient.delete({ where: { id: clientId } }).catch(() => undefined);
        await db.$disconnect();
    }

    console.log(failures === 0 ? '\nИТОГ: PASS' : `\nИТОГ: провалов ${failures}`);
    process.exit(failures === 0 ? 0 : 1);
})();
