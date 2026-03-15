import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
    console.log('Starting legal consent migration...')

    try {
        // 1. Ensure initial document versions exist
        console.log('Ensuring base documents exist...')
        
        let termsDoc = await db.legalDocument.findFirst({ where: { type: 'TERMS', isActive: true } })
        if (!termsDoc) {
            termsDoc = await db.legalDocument.create({
                data: { type: 'TERMS', version: 'v1.0', url: '/legal/terms', isActive: true, publishedAt: new Date() }
            })
            console.log('Created base TERMS document')
        }

        let privacyDoc = await db.legalDocument.findFirst({ where: { type: 'PRIVACY', isActive: true } })
        if (!privacyDoc) {
            privacyDoc = await db.legalDocument.create({
                data: { type: 'PRIVACY', version: 'v1.0', url: '/legal/privacy', isActive: true, publishedAt: new Date() }
            })
            console.log('Created base PRIVACY document')
        }

        let adsDoc = await db.legalDocument.findFirst({ where: { type: 'ADS', isActive: true } })
        if (!adsDoc) {
            adsDoc = await db.legalDocument.create({
                data: { type: 'ADS', version: 'v1.0', url: '#', isActive: true, publishedAt: new Date() }
            })
            console.log('Created base ADS document')
        }

        // 2. Query old consent data using raw SQL (in case columns still exist but are omitted from schema)
        console.log('Querying legacy consent data...')
        
        try {
            const usersWithPdn: any[] = await db.$queryRaw`SELECT id, "pdnConsentDate" FROM "User" WHERE "pdnConsentDate" IS NOT NULL`
            console.log(`Found ${usersWithPdn.length} users with legacy PDN consent. Migrating...`)
            
            let pdnCount = 0
            for (const user of usersWithPdn) {
                // Migrate to TERMS & PRIVACY
                await db.legalDocumentAcceptance.upsert({
                    where: { userId_documentId: { userId: user.id, documentId: termsDoc.id } },
                    create: { userId: user.id, documentId: termsDoc.id, acceptedAt: user.pdnConsentDate },
                    update: {}
                })
                await db.legalDocumentAcceptance.upsert({
                    where: { userId_documentId: { userId: user.id, documentId: privacyDoc.id } },
                    create: { userId: user.id, documentId: privacyDoc.id, acceptedAt: user.pdnConsentDate },
                    update: {}
                })
                pdnCount++
            }
            console.log(`Migrated ${pdnCount} TERMS/PRIVACY acceptances.`)
        } catch (e: any) {
            console.log('Legacy PDN columns not found or error querying them. Skipping PDN migration.', e.message)
        }

        try {
            const usersWithAds: any[] = await db.$queryRaw`SELECT id, "adsConsentDate" FROM "User" WHERE "adsConsentDate" IS NOT NULL`
            console.log(`Found ${usersWithAds.length} users with legacy ADS consent. Migrating...`)
            
            let adsCount = 0
            for (const user of usersWithAds) {
                await db.legalDocumentAcceptance.upsert({
                    where: { userId_documentId: { userId: user.id, documentId: adsDoc.id } },
                    create: { userId: user.id, documentId: adsDoc.id, acceptedAt: user.adsConsentDate },
                    update: {}
                })
                adsCount++
            }
            console.log(`Migrated ${adsCount} ADS acceptances.`)
        } catch (e: any) {
            console.log('Legacy ADS columns not found or error querying them. Skipping ADS migration.', e.message)
        }

        console.log('Migration completed successfully!')

    } catch (error) {
        console.error('Fatal error during migration:', error)
    } finally {
        await db.$disconnect()
    }
}

main()
