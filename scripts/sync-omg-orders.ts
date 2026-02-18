#!/usr/bin/env npx tsx
/**
 * CLI script to sync orders from OMG
 * Usage: npx tsx scripts/sync-omg-orders.ts [--days=14] [--full]
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

async function main() {
  const args = process.argv.slice(2)
  const daysArg = args.find(a => a.startsWith('--days='))
  const fullResync = args.includes('--full')
  const sinceDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : 14
  
  console.log(`🔄 OMG Order Sync starting...`)
  console.log(`   sinceDays: ${sinceDays}`)
  console.log(`   fullResync: ${fullResync}`)
  
  const prisma = new PrismaClient()
  
  try {
    const { getOmgOrderSyncService } = await import('../lib/infrastructure/omg')
    const service = getOmgOrderSyncService(prisma)
    
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    
    const result = await service.syncAll({
      since,
      fullResync,
      triggerThreadDiscovery: true,
    })
    
    console.log('\n✅ Sync complete!')
    console.log(`   Orders created: ${result.ordersCreated}`)
    console.log(`   Orders updated: ${result.ordersUpdated}`)
    console.log(`   Orders skipped: ${result.ordersSkipped}`)
    console.log(`   POs created: ${result.posCreated}`)
    console.log(`   POs updated: ${result.posUpdated}`)
    console.log(`   Total processed: ${result.totalOrdersProcessed}`)
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`)
      for (const err of result.errors.slice(0, 5)) {
        console.log(`   - ${err.orderNumber}: ${err.error}`)
      }
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`)
      }
    }
    
    return result
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(result => {
    process.exit(result.errors.length > 0 ? 1 : 0)
  })
  .catch(err => {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  })
