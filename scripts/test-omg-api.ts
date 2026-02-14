/**
 * Test script for OMG API client
 * Run with: npx tsx scripts/test-omg-api.ts
 */

import { listOrders, getPurchaseOrders, getAllTrackingNumbers } from '../lib/infrastructure/omg'

async function main() {
  console.log('Testing OMG API client...\n')

  // Test 1: List orders
  console.log('=== Test 1: List Orders ===')
  const { orders, total } = await listOrders(0, 5)
  console.log(`Found ${total} total orders. First 5:`)
  for (const order of orders) {
    console.log(`  #${order.number} - ${order.name} (${order.customer?.name})`)
  }

  // Test 2: Get POs for first order
  if (orders.length > 0) {
    console.log('\n=== Test 2: Purchase Orders ===')
    const pos = await getPurchaseOrders(orders[0]._id)
    console.log(`Order #${orders[0].number} has ${pos.length} PO(s):`)
    for (const po of pos) {
      console.log(`  PO ${po.poNumber} - ${po.status?.operations} - ${po.tracking?.length || 0} tracking entries`)
    }
  }

  // Test 3: Get all tracking numbers (limited for test)
  console.log('\n=== Test 3: All Tracking Numbers ===')
  const tracking = await getAllTrackingNumbers()
  console.log(`Found ${tracking.length} tracking entries:`)
  for (const t of tracking.slice(0, 10)) {
    console.log(`  ${t.trackingNumber} (${t.carrier}) - PO ${t.poNumber} - ${t.customerName}`)
  }
  if (tracking.length > 10) {
    console.log(`  ... and ${tracking.length - 10} more`)
  }

  console.log('\n✅ All tests passed!')
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
