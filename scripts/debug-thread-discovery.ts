/**
 * Debug script to check thread discovery for a shipment
 * Usage: npx tsx scripts/debug-thread-discovery.ts <shipmentId>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const shipmentId = parseInt(process.argv[2], 10)
  if (!shipmentId) {
    console.error('Usage: npx tsx scripts/debug-thread-discovery.ts <shipmentId>')
    process.exit(1)
  }

  console.log(`\n🔍 Debugging thread discovery for shipment ${shipmentId}\n`)

  // 1. Get shipment
  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
    select: { id: true, po_number: true, tracking_number: true, status: true }
  })

  if (!shipment) {
    console.error('❌ Shipment not found')
    process.exit(1)
  }

  console.log('📦 Shipment:', shipment)

  // 2. Get OMG data (normalize PO number)
  if (shipment.po_number) {
    const normalizedPo = shipment.po_number.replace(/^(\d+)-0*(\d+)$/, '$1-$2')
    console.log(`\n🔗 Looking up OMG data for PO: ${shipment.po_number} (normalized: ${normalizedPo})`)

    const omgRecord = await prisma.omg_purchase_orders.findUnique({
      where: { po_number: normalizedPo },
      select: { 
        order_number: true, 
        order_name: true, 
        customer_name: true, 
        customer_email: true 
      }
    })

    if (omgRecord) {
      console.log('📋 OMG Record:', omgRecord)
      
      if (!omgRecord.customer_email) {
        console.log('\n⚠️  NO CUSTOMER EMAIL - Thread discovery cannot search Front')
      } else {
        console.log(`\n✅ Customer email found: ${omgRecord.customer_email}`)
        console.log(`   Order number for matching: ${omgRecord.order_number}`)
      }
    } else {
      console.log('❌ No OMG record found for this PO')
    }
  } else {
    console.log('\n⚠️  Shipment has no PO number')
  }

  // 3. Check existing thread link
  const threadLink = await prisma.shipment_customer_threads.findUnique({
    where: { shipment_id: shipmentId }
  })

  if (threadLink) {
    console.log('\n🧵 Existing thread link:', {
      status: threadLink.match_status,
      confidence: threadLink.confidence_score,
      conversationId: threadLink.front_conversation_id || '(none)',
      subject: threadLink.conversation_subject || '(none)',
      emailMatched: threadLink.email_matched,
      orderInSubject: threadLink.order_in_subject,
    })
  } else {
    console.log('\n🧵 No thread link record exists yet')
  }

  // 4. Check audit history
  const auditEntries = await prisma.audit_history.findMany({
    where: {
      entity_type: 'shipment',
      entity_id: String(shipmentId),
      action: { startsWith: 'thread.' }
    },
    orderBy: { created_at: 'desc' },
    take: 5
  })

  if (auditEntries.length > 0) {
    console.log('\n📜 Recent audit entries:')
    auditEntries.forEach(e => {
      console.log(`   [${e.status}] ${e.action} at ${e.created_at.toISOString()}`)
      if (e.metadata) console.log('      ', e.metadata)
    })
  }

  await prisma.$disconnect()
}

main().catch(console.error)
