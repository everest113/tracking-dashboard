import { PrismaClient } from '@prisma/client'
import { getOmgOrderSyncService } from '../lib/infrastructure/omg'

async function main() {
  const prisma = new PrismaClient()
  
  const service = getOmgOrderSyncService(prisma)
  
  const sinceDays = 14
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  
  console.log(`Syncing orders from OMG (since ${since.toISOString()})...`)
  
  const result = await service.syncAll({
    since,
    fullResync: false,
    triggerThreadDiscovery: true,
  })
  
  console.log('\n=== Sync Results ===')
  console.log(JSON.stringify(result, null, 2))
  
  await prisma.$disconnect()
}

main().catch(console.error)
