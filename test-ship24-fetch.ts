import { createShip24Client } from './lib/infrastructure/sdks/ship24/client'

async function testFetch() {
  const client = createShip24Client()
  
  // Get a tracking number from the database
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  
  const shipment = await prisma.shipments.findFirst({
    where: {
      ship24_tracker_id: { not: null }
    },
    orderBy: { created_at: 'desc' }
  })
  
  if (!shipment) {
    console.log('No shipments with tracker ID found')
    return
  }
  
  console.log('\n=== Testing Ship24 Fetch ===')
  console.log('Tracking Number:', shipment.tracking_number)
  console.log('Tracker ID:', shipment.ship24_tracker_id)
  console.log('Current Status in DB:', shipment.status)
  console.log('Current Estimated Delivery in DB:', shipment.estimated_delivery)
  
  try {
    const response = await client.getTrackerResults(shipment.ship24_tracker_id!)
    console.log('\n=== Ship24 Response ===')
    console.log(JSON.stringify(response, null, 2))
    
    const tracking = response.data.trackings[0]
    if (tracking) {
      console.log('\n=== Tracking Data ===')
      console.log('Status Milestone:', tracking.shipment?.statusMilestone)
      console.log('Status:', tracking.shipment?.status)
      console.log('Shipped Date:', tracking.shipment?.shipDate)
      console.log('Estimated Delivery:', tracking.shipment?.delivery?.estimatedDeliveryDate)
      console.log('Actual Delivery:', tracking.shipment?.delivery?.actualDeliveryDate)
      console.log('Events Count:', tracking.events?.length || 0)
    } else {
      console.log('\n⚠️  No tracking data in response')
    }
  } catch (error) {
    console.error('Error:', error)
  }
  
  await prisma.$disconnect()
}

testFetch()
