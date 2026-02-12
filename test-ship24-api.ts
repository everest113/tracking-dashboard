import 'dotenv/config'

const API_KEY = process.env.SHIP24_API_KEY

// Test bulk tracker creation
async function testBulk() {
  console.log('\n=== Testing Bulk Tracker Creation ===')
  
  const payload = [
    {
      trackingNumber: '1ZW9843X0352061172',
      courierCode: ['ups'],
      shipmentReference: 'TEST-PO-123'
    },
    {
      trackingNumber: '9400100000000000000000',
      courierCode: ['usps']
    }
  ]
  
  console.log('Payload:', JSON.stringify(payload, null, 2))
  
  const response = await fetch('https://api.ship24.com/public/v1/trackers/bulk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  
  const data = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
}

testBulk().catch(console.error)
