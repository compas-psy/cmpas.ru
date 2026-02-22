import { db } from './src/lib/db'

async function main() {
    const user = await db.user.findUnique({ where: { email: 'eliah@yandex.ru' } })
    if (!user) { console.log("Not found"); return }
    const slots = await db.availabilitySlot.findMany({ where: { psychologistId: user.id } })
    const blocks = await db.timeBlock.findMany({ where: { psychologistId: user.id } })
    const settings = await db.psychologistSettings.findUnique({ where: { psychologistId: user.id } })

    console.log("------- SLOTS -------")
    console.log(slots)

    console.log("------- BLOCKS -------")
    console.log(blocks)

    console.log("------- SETTINGS -------")
    console.log(settings)
}

main().catch(console.error).finally(() => process.exit(0))
