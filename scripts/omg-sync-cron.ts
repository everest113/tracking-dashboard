import { PrismaClient } from '@prisma/client'
import { getOmgOrderSyncService } from '../lib/infrastructure/omg'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    const service = getOmgOrderSyncService(prisma)
    
    const sinceDays = parseInt(process.argv[2] || '14', 10)
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    
    console.log(`🔄 Syncing OMG orders since ${since.toISOString()} (${sinceDays} days)...`)
    
    const result = await service.syncAll({
      since,
      fullResync: false,
      triggerThreadDiscovery: true,
    })
    
    console.log(JSON.stringify(result, null, 2))
    
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
