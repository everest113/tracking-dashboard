import type { EmailMessage } from './schemas'

/**
 * System prompt for tracking extraction AI
 */
export const SYSTEM_PROMPT = `You are an expert at extracting shipping and supplier information from email threads.
You are precise and only return valid JSON. Only include shipments with valid tracking numbers.`

/**
 * Build extraction prompt from email messages
 */
export function buildExtractionPrompt(messages: EmailMessage[]): string {
  // Build comprehensive context from all messages
  const threadContext = messages.map((msg, idx) => `
--- Message ${idx + 1} ---
Subject: ${msg.subject}
From: ${msg.senderName || msg.senderEmail || 'Unknown'}
Email: ${msg.senderEmail || 'Unknown'}
Sent Date: ${msg.sentDate ? msg.sentDate.toISOString() : 'Unknown'}
Body:
${msg.body}
`).join('\n\n')

  return `Extract ALL tracking numbers, PO numbers, shipped dates, AND identify the supplier company from this email conversation.

${threadContext}

Instructions:
1. Find ALL tracking numbers (UPS, USPS, FedEx, DHL, etc.)
2. Identify the carrier for each tracking number
3. Extract PO number if mentioned in ANY message or subject line (look for "PO", "P.O.", "Purchase Order", "Order #", "SO", "S.O.", etc.)
4. **Extract SHIPPED DATE from email content:**
   - Look for "shipped on", "shipped date", "dispatch date", "sent on", etc.
   - Parse dates in any format (MM/DD/YYYY, YYYY-MM-DD, "January 15, 2024", etc.)
   - Return as ISO date string (YYYY-MM-DD)
   - If no shipped date found in content, the system will use the email sent date as fallback
5. **IDENTIFY THE SUPPLIER COMPANY** using:
   - Email signature/footer (company name, logo text, contact info)
   - Sender's email domain (e.g., @acmecorp.com → "Acme Corp")
   - Company name mentioned in body or signature
   - "From" line company information
   - Email footer contact information
6. Return your confidence level (0-1) for each extraction

Tracking number formats:
- UPS: Starts with "1Z" followed by 16 characters (letters/numbers)
- USPS: 20-22 digits, or 13 characters starting with letters
- FedEx: 12-14 digits
- DHL: 10-11 digits

Supplier Identification Priority:
1. Company name from email signature/footer (highest priority)
2. Company name from email domain
3. Sender's name if no company found

Return a JSON object with shipments array and supplier string.

Example response:
{
  "supplier": "Acme Manufacturing Co.",
  "shipments": [
    {
      "trackingNumber": "1Z999AA10123456784",
      "carrier": "ups",
      "poNumber": "PO-12345",
      "shippedDate": "2024-02-08",
      "confidence": 0.95
    }
  ]
}

IMPORTANT: 
- **ONLY include shipments with valid tracking numbers** - do not return empty or null trackingNumber
- Normalize tracking numbers (remove spaces, dashes)
- Return carrier as lowercase: "ups", "usps", "fedex", "dhl", or "other"
- If unsure about carrier, use "other"
- If no PO number found in ANY message or subject, omit the field
- **For shippedDate: only include if explicitly mentioned in email content** - system will use email sent date as fallback if omitted
- Search both message bodies AND subject lines for PO numbers and dates
- **ALWAYS try to identify supplier** - use company name from signature/footer, or derive from email domain if needed
- If supplier cannot be determined, return sender's name as fallback
- **If no valid tracking numbers found, return empty shipments array**`
}
