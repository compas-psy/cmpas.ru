import { db } from './src/lib/db';
import { getAvailableTimes } from './src/app/bot/actions';

async function main() {
    const psycho = await db.user.findFirst({ where: { role: 'psychologist' } });
    if (!psycho) {
        console.log('No psycho');
        return;
    }

    console.log('Testing psycho:', psycho.id, psycho.name);
    try {
        const times = await getAvailableTimes(psycho.id, '2026-03-12', true);
        console.log('Available Times for 03-12:', times);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
