import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod'

const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string().optional(),
  shippedDate: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const TrackingExtractionResultSchema = z.object({
  supplier: z.string().optional(),
  shipments: z.array(ExtractedShipmentSchema),
});

const testEmail = `Subject: S&S Activewear - Packing Lists - 1/20/2026
From: S&S Activewear <mail@ssactivewear.com>

S&S Activewear Invoices 1/20/2026 - Stitchi (688815) 
Order Date Type WH Order # Invoice # PO # Ship Date Status Total Track (NT)= No Tracking 
1/9/2026 Credit IL 69175350 93989592 1/20/2026 Shipped ($21.51) 1ZE9W0619097696048`;

async function test() {
  console.log('Testing extraction with fixed schema...\n');
  
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TrackingExtractionResultSchema,
      system: 'Extract tracking numbers and supplier from emails',
      prompt: `Extract tracking information:\n\n${testEmail}`
    });
    
    console.log('✅ EXTRACTION SUCCESSFUL!\n');
    console.log(JSON.stringify(object, null, 2));
    
    if (object.shipments.length > 0) {
      console.log('\n🎯 Found tracking:', object.shipments[0].trackingNumber);
      console.log('Carrier:', object.shipments[0].carrier);
      console.log('Supplier:', object.supplier || '(not found)');
    }
    
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
}

test();
