/**
 * Backfill customer_email for existing omg_purchase_orders records.
 *
 * This script extracts customer email from the raw_data JSON field
 * and populates the new customer_email column.
 *
 * Usage:
 *   npx tsx scripts/backfill-customer-emails.ts
 *   npx tsx scripts/backfill-customer-emails.ts --dry-run
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface RawData {
  order?: {
    customer?: {
      email?: string[]
    }
  }
}

async function backfillCustomerEmails(dryRun: boolean = false) {
  console.log(`\n🔄 Backfilling customer_email${dryRun ? ' (DRY RUN)' : ''}...\n`)

  // Find all records that don't have customer_email yet
  // We'll filter for non-null raw_data in code since Prisma JSON filtering is tricky
  const allRecords = await prisma.omg_purchase_orders.findMany({
    where: {
      customer_email: null,
    },
    select: {
      id: true,
      po_number: true,
      customer_name: true,
      raw_data: true,
    },
  })

  // Filter to only records that have raw_data
  const records = allRecords.filter((r) => r.raw_data !== null)

  console.log(`Found ${records.length} records to process\n`)

  let updated = 0
  let skipped = 0
  let noEmail = 0

  for (const record of records) {
    const rawData = record.raw_data as RawData | null

    // Extract email from raw_data.order.customer.email (array)
    const email = rawData?.order?.customer?.email?.[0]

    if (!email) {
      noEmail++
      continue
    }

    if (dryRun) {
      console.log(`  Would update PO ${record.po_number}: ${email}`)
      updated++
    } else {
      await prisma.omg_purchase_orders.update({
        where: { id: record.id },
        data: { customer_email: email },
      })
      console.log(`  ✓ Updated PO ${record.po_number}: ${email}`)
      updated++
    }
  }

  console.log(`
📊 Results:
   Updated: ${updated}
   No email in raw_data: ${noEmail}
   Skipped: ${skipped}
   Total processed: ${records.length}
`)

  // Also check records without raw_data that might need re-sync
  const noRawData = await prisma.omg_purchase_orders.count({
    where: {
      customer_email: null,
      raw_data: null,
    },
  })

  if (noRawData > 0) {
    console.log(`⚠️  ${noRawData} records have no raw_data and need re-sync from OMG`)
    console.log(`   Run: npx tsx scripts/resync-omg-orders.ts`)
  }
}

// Parse args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

backfillCustomerEmails(dryRun)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
