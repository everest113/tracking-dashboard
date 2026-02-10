#!/usr/bin/env tsx
/**
 * Backfill Ship24 tracking data for all shipments with tracker IDs
 * Run this to fetch latest data from Ship24 and update the database
 */

import { PrismaClient } from '@prisma/client'
import { createShip24Client } from '../lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '../lib/infrastructure/mappers/Ship24Mapper'

const prisma = new PrismaClient()
const ship24 = createShip24Client()

async function backfillShip24Data() {
  console.log('🔄 Fetching shipments with tracker IDs...')
  
  const shipments = await prisma.shipments.findMany({
    where: {
      ship24_tracker_id: { not: null }
    },
    orderBy: { created_at: 'desc' }
  })
  
  console.log(`Found ${shipments.length} shipments to update\n`)
  
  let updated = 0
  let failed = 0
  
  for (const shipment of shipments) {
    try {
      console.log(`Fetching tracker: ${shipment.tracking_number} (${shipment.ship24_tracker_id})`)
      
      const response = await ship24.getTrackerResults(shipment.ship24_tracker_id!)
      const tracking = response.data.trackings[0]
      
      if (!tracking) {
        console.log(`  ⚠️  No tracking data available yet`)
        continue
      }
      
      const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)
      
      await prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          status: updateData.status.type,
          carrier: updateData.carrier || shipment.carrier,
          shipped_date: updateData.shippedDate,
          estimated_delivery: updateData.estimatedDelivery,
          delivered_date: updateData.deliveredDate,
          ship24_status: tracking.shipment?.statusMilestone || null,
          ship24_last_update: new Date(),
          last_checked: new Date(),
          last_error: null,
        }
      })
      
      console.log(`  ✅ Updated: ${updateData.status.type}${updateData.deliveredDate ? ` (delivered ${updateData.deliveredDate.toLocaleDateString()})` : ''}`)
      updated++
      
      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error(`  ❌ Error: ${error}`)
      failed++
      
      await prisma.shipments.update({
        where: { id: shipment.id },
        data: {
          last_error: String(error),
          last_checked: new Date(),
        }
      })
    }
  }
  
  console.log(`\n✅ Backfill complete!`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Failed: ${failed}`)
  
  await prisma.$disconnect()
}

backfillShip24Data().catch(console.error)
