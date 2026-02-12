import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Use the FIXED schema from our codebase
const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string().nullable().default(null),  // FIXED: nullable with default
  shippedDate: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.8),
});

const TrackingExtractionResultSchema = z.object({
  supplier: z.string().nullable().default(null),
  shipments: z.array(ExtractedShipmentSchema),
});

const testEmail = {
  subject: 'S&S Activewear - Packing Lists - 1/20/2026',
  body: `S&S Activewear Invoices 1/20/2026 - Stitchi (688815) 
Order Date Type WH Order # Invoice # PO # Ship Date Status Total Track (NT)= No Tracking 
1/9/2026 Credit IL 69175350 93989592 1/20/2026 Shipped ($21.51) 1ZE9W0619097696048`,
  senderEmail: 'mail@ssactivewear.com',
  senderName: 'S&S Activewear'
};

async function testExtraction() {
  console.log('Testing with REAL email from database...\n');
  
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TrackingExtractionResultSchema,
      system: 'You are a precise data extraction assistant. Extract tracking numbers, carrier, PO numbers, and supplier from emails.',
      prompt: `Extract tracking information from this email:

Subject: ${testEmail.subject}
From: ${testEmail.senderName} <${testEmail.senderEmail}>

${testEmail.body}

Instructions:
- Find tracking numbers (UPS starts with 1Z, USPS is 20-22 digits)
- Identify carrier (ups, usps, fedex, dhl, other)
- Extract PO number if present
- Identify supplier company

Return JSON with supplier and shipments array.`
    });
    
    console.log('✅ SUCCESS - Extraction result:');
    console.log(JSON.stringify(object, null, 2));
    
    if (object.shipments.length > 0) {
      console.log('\n✅ Found', object.shipments.length, 'shipment(s)');
      console.log('This proves extraction works when API key is valid!');
    }
    
  } catch (err) {
    console.log('❌ ERROR:');
    console.log(err.message);
  }
}

testExtraction();
