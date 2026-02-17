import 'dotenv/config'
import { getOmgOrderSyncService } from '../lib/infrastructure/omg'
import { prisma } from '../lib/prisma'

async function main() {
  const sinceDays = 14
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  
  console.log(`Syncing OMG orders from ${since.toISOString()}...`)
  
  const service = getOmgOrderSyncService(prisma)
  const result = await service.syncAll({
    since,
    fullResync: false,
    triggerThreadDiscovery: true,
  })
  
  console.log(JSON.stringify(result, null, 2))
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
