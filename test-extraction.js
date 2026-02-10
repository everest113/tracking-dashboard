const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWithDatabase() {
  // Get a conversation we know has tracking
  const conv = await prisma.scanned_conversations.findFirst({
    where: {
      subject: { contains: 'S&S Activewear - Packing Lists - 1/20/2026' }
    }
  });
  
  if (conv) {
    console.log('Found scanned conversation:');
    console.log('Subject:', conv.subject);
    console.log('Shipments found:', conv.shipments_found);
    console.log('Conversation ID:', conv.conversation_id);
    console.log('Scanned at:', conv.scanned_at);
  } else {
    console.log('Conversation not yet scanned');
  }
  
  // Check if any shipments were created
  const shipments = await prisma.shipments.findMany({
    where: {
      tracking_number: '1ZE9W0619097696048'
    }
  });
  
  console.log('\nShipments with tracking 1ZE9W0619097696048:', shipments.length);
  
  if (shipments.length > 0) {
    console.log('✅ Shipment was extracted!');
    console.log(shipments[0]);
  } else {
    console.log('❌ Shipment was NOT extracted despite being in email body');
  }
  
  await prisma.$disconnect();
}

testWithDatabase().catch(console.error);
