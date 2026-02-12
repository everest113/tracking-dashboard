import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const ExtractedShipmentSchema = z.object({
  trackingNumber: z.string().min(1),
  carrier: z.enum(['ups', 'usps', 'fedex', 'dhl', 'other']),
  poNumber: z.string().nullable().default(null),
  shippedDate: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.8),
});

const TrackingExtractionResultSchema = z.object({
  supplier: z.string().nullable().default(null),
  shipments: z.array(ExtractedShipmentSchema),
});

const testEmail = `S&S Activewear Invoices 1/20/2026 - Stitchi (688815) 
Order Date Type WH Order # Invoice # PO # Ship Date Status Total Track (NT)= No Tracking 
1/9/2026 Credit IL 69175350 93989592 1/20/2026 Shipped ($21.51) 1ZE9W0619097696048`;

async function testExtraction() {
  console.log('Testing OpenAI extraction...\n');
  console.log('Email content:');
  console.log(testEmail);
  console.log('\n---\n');
  
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: TrackingExtractionResultSchema,
      system: 'Extract tracking numbers from emails',
      prompt: `Extract tracking numbers from this email:\n\n${testEmail}`
    });
    
    console.log('✅ SUCCESS - Extraction result:');
    console.log(JSON.stringify(object, null, 2));
    
  } catch (err) {
    console.log('❌ ERROR during extraction:');
    console.log('Message:', err.message);
    console.log('\nFull error:');
    console.log(err);
  }
}

testExtraction();
