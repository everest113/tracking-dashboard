import type { EmailMessage } from './schemas'

/**
 * Build email thread context string (shared between prompts)
 */
function buildThreadContext(messages: EmailMessage[]): string {
  return messages.map((msg, idx) => `
--- Message ${idx + 1} ---
Subject: ${msg.subject}
From: ${msg.senderName || msg.senderEmail || 'Unknown'}
Email: ${msg.senderEmail || 'Unknown'}
Sent Date: ${msg.sentDate ? msg.sentDate.toISOString() : 'Unknown'}
Body:
${msg.body}
`).join('\n\n')
}

/**
 * Prompt 1: Extract tracking numbers + shipped date
 * 
 * This prompt is focused on identifying valid carrier tracking numbers
 * and the date the shipment was sent. These are closely related - often
 * mentioned together in shipping notifications.
 */
export function buildTrackingOnlyPrompt(messages: EmailMessage[]): string {
  const threadContext = buildThreadContext(messages)

  return `Extract valid shipping carrier tracking numbers and shipped dates from this email conversation.

${threadContext}

## Your Task
1. Find tracking numbers for packages shipped via UPS, USPS, FedEx, DHL, or other carriers
2. Extract the shipped date for each tracking number (if mentioned)

## Valid Tracking Number Formats

**UPS:**
- Starts with "1Z" followed by exactly 16 alphanumeric characters
- Example: 1Z999AA10123456784
- Total length: 18 characters

**USPS:**
- 20-22 digits (no letters)
- Example: 92001902111503000000012345
- OR 13 characters starting with 2 letters (international)
- Example: LZ123456789US

**FedEx:**
- 12, 14, or 15 digits (no letters)
- Example: 123456789012

**DHL:**
- 10 digits starting with a number (NOT a phone number pattern like area codes)
- Often starts with prefix like 1, 2, 3, 4, 5, or 7
- Example: 1234567890
- OR waybill format with letters: JJD0001234567

## CRITICAL: What NOT to Extract

DO NOT extract these as tracking numbers:
- Phone numbers (10 digits with area code pattern like 555-123-4567 or 5551234567)
- PO numbers / Purchase order numbers
- Order numbers / Order IDs / Reference numbers
- Invoice numbers
- Account numbers
- Any number that appears after "PO", "Order", "Invoice", "Ref", "Account"
- Partial numbers or fragments
- Numbers embedded in email addresses or URLs

## Shipped Date Extraction

For each tracking number, look for shipped date:
- "shipped on", "shipped date", "dispatch date", "sent on", "ship date"
- Often appears near the tracking number in the text
- Parse any date format and return as ISO (YYYY-MM-DD)
- If no shipped date found for a tracking number, return empty string ""

## Rules

1. Only extract numbers that CLEARLY match carrier tracking formats above
2. If a number COULD be a phone number or order number, DO NOT extract it
3. When in doubt, DO NOT include it - false negatives are better than false positives
4. Return confidence 0.9+ only if format perfectly matches a known carrier
5. Return confidence 0.7-0.9 if likely valid but format is ambiguous
6. If NO valid tracking numbers found, return empty shipments array

## Response Format

Return tracking numbers with carrier, shipped date, and confidence.
If no tracking numbers found, return: { "shipments": [] }

Example with tracking:
{
  "shipments": [
    { "trackingNumber": "1Z999AA10123456784", "carrier": "ups", "shippedDate": "2024-02-08", "confidence": 0.95 }
  ]
}

Example without shipped date:
{
  "shipments": [
    { "trackingNumber": "1Z999AA10123456784", "carrier": "ups", "shippedDate": "", "confidence": 0.95 }
  ]
}

Example without tracking:
{
  "shipments": []
}`
}

/**
 * Prompt 2: Extract metadata (supplier, PO)
 * 
 * This prompt is called ONLY if tracking numbers were found.
 * It focuses on context comprehension - identifying business context.
 */
export function buildMetadataPrompt(messages: EmailMessage[]): string {
  const threadContext = buildThreadContext(messages)

  return `Extract supplier information and PO number from this email conversation.

${threadContext}

## Your Task
Extract business context about this shipment.

## 1. Supplier Company Name
Identify the company that sent this shipment:
- Look at email signature/footer for company name
- Check the sender's email domain (e.g., @acmecorp.com → "Acme Corp")  
- Look for company name in the body text
- Use sender's name as fallback if no company found

## 2. PO Number (Purchase Order)
Look for patterns like:
- "PO", "P.O.", "PO#", "PO:"
- "Purchase Order"
- "Order #", "Order:"
- "SO", "S.O." (Sales Order)
- Check BOTH subject line and body

## Response Format

{
  "supplier": "Company Name or empty string",
  "poNumber": "PO-12345 or empty string"
}

Return empty string "" for any field not found. Do NOT guess or fabricate values.`
}

// ============================================
// Legacy: Combined prompt (kept for reference)
// ============================================

/**
 * @deprecated Use buildTrackingOnlyPrompt + buildMetadataPrompt instead
 */
export function buildTrackingExtractionInstructions(messages: EmailMessage[]): string {
  const threadContext = buildThreadContext(messages)

  return `Extract ALL tracking numbers, PO numbers, shipped dates, AND identify the supplier company from this email conversation.

${threadContext}

Instructions:
1. Find ALL tracking numbers (UPS, USPS, FedEx, DHL, etc.)
2. Identify the carrier for each tracking number
3. Extract PO number if mentioned in ANY message or subject line
4. Extract SHIPPED DATE from email content
5. IDENTIFY THE SUPPLIER COMPANY
6. Return your confidence level (0-1) for each extraction

IMPORTANT: 
- ONLY include shipments with valid tracking numbers
- If no valid tracking numbers found, return empty shipments array

Return a JSON object with shipments array and supplier string.`
}
