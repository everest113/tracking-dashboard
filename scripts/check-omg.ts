import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const shipments = await prisma.shipments.findMany({
    where: { po_number: { not: null } },
    select: { id: true, tracking_number: true, po_number: true },
    take: 20,
    orderBy: { created_at: 'desc' },
  })

  const poNumbers = [...new Set(shipments.map((s) => s.po_number!).filter(Boolean))]
  const omgRecords = await prisma.omg_purchase_orders.findMany({
    where: { po_number: { in: poNumbers } },
  })

  console.log('Shipments:')
  for (const shipment of shipments) {
    const omg = shipment.po_number ? omgRecords.find((o) => o.po_number === shipment.po_number) : null
    console.log(
      `${shipment.id} | ${shipment.po_number} | tracking=${shipment.tracking_number} | omg=${omg ? 'yes' : 'no'} | order=${
        omg?.order_number ?? ''
      }`
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
