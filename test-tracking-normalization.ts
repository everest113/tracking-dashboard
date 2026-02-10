// Quick test of tracking number normalization
import { extractTracking } from './lib/infrastructure/sdks/extraction/modules/shipping/tracking'

const testMessages = [{
  subject: 'Shipment Notification',
  senderName: 'Supplier',
  senderEmail: 'supplier@example.com',
  body: 'Your order has shipped via USPS tracking: USPS 9200 1902 1115 0300 0000 0000',
  sentDate: new Date(),
}]

extractTracking(testMessages).then(result => {
  console.log('Result:', JSON.stringify(result, null, 2))
  const tracking = result.shipments[0]?.trackingNumber
  console.log('\nTracking Number:', tracking)
  console.log('Has USPS prefix?', tracking?.startsWith('USPS'))
  console.log('Expected: 92001902111503000000000000')
})
