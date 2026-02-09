# Enhanced Supplier Extraction

## Problem

Previously, the supplier was set to just the sender's name or email address (e.g., "John Smith" or "john@acme.com"). This didn't identify the actual **supplier company**.

## Solution

Now the AI analyzes the entire email content to extract the **actual supplier company name** using:

1. **Email signature/footer** - Company name, logo text
2. **Email domain** - Derives company from sender's email domain
3. **Body content** - Company mentions in email text
4. **Contact information** - Company info in footer

## How It Works

### AI Extraction Priority

The AI now looks for supplier information in this order:

1. **Company name from email signature/footer** (highest priority)
   - Example: "Acme Manufacturing Co."
   - Example: "Best regards, Sarah | ABC Textiles Inc."

2. **Company name from email domain**
   - Email: `sarah@acmetextiles.com` → "Acme Textiles"
   - Email: `john@bestproducts.net` → "Best Products"

3. **Sender's name** (fallback if no company found)
   - Only used if company cannot be determined

### Example Email

**Before (just sender name):**
```
From: Sarah Johnson <sarah@acmetextiles.com>

Supplier saved as: "Sarah Johnson"
```

**After (AI extracts company):**
```
From: Sarah Johnson <sarah@acmetextiles.com>

Body:
Your order has shipped!

--
Sarah Johnson
Sales Manager
Acme Textiles Inc.
123 Manufacturing Way
(555) 123-4567

Supplier saved as: "Acme Textiles Inc."
```

## Technical Changes

### 1. Updated `lib/tracking-extractor.ts`

**Added supplier extraction to AI prompt:**
```typescript
export type ExtractionResult = {
  shipments: ExtractedShipment[]
  supplier?: string  // ← New field
  rawResponse?: string
}
```

**Enhanced prompt instructions:**
```
5. **IDENTIFY THE SUPPLIER COMPANY** using:
   - Email signature/footer (company name, logo text, contact info)
   - Sender's email domain (e.g., @acmecorp.com → "Acme Corp")
   - Company name mentioned in body or signature
   - "From" line company information
   - Email footer contact information
```

**Example AI response:**
```json
{
  "supplier": "Acme Manufacturing Co.",
  "shipments": [
    {
      "trackingNumber": "1Z999AA10123456784",
      "carrier": "ups",
      "poNumber": "PO-12345"
    }
  ]
}
```

### 2. Updated `app/api/front/scan/route.ts`

**Now uses AI-extracted supplier:**
```typescript
// Extract tracking info and supplier using OpenAI
const extraction = await extractTrackingInfo(messagesToExtract)

// Use AI-extracted supplier name, or fall back to sender info
const supplierName = extraction.supplier 
  || messages[0]?.author?.name 
  || messages[0]?.author?.email 
  || 'Unknown Supplier'

console.log(`Supplier identified: ${supplierName}`)
```

## Examples

### Example 1: Email with Signature
```
From: Mike Chen <mike@globalproducts.com>

Hi,

Your order PO-5678 has shipped via UPS: 1Z999AA10123456789

Thanks,
Mike Chen
Account Manager
Global Products International
www.globalproducts.com

Extracted Supplier: "Global Products International"
```

### Example 2: Email Domain Only
```
From: orders@supremesupplies.com

Order shipped.
Tracking: 1234567890

(No signature)

Extracted Supplier: "Supreme Supplies" (derived from domain)
```

### Example 3: Complex Footer
```
From: Jane Smith <j.smith@abctextiles.com>

Shipment notification...

--
Jane Smith | Senior Sales Rep
ABC Textiles & Manufacturing Ltd.
Portland, OR | (503) 555-1234
jane.smith@abctextiles.com

Extracted Supplier: "ABC Textiles & Manufacturing Ltd."
```

### Example 4: No Company Info
```
From: john@gmail.com

Here's your tracking: 1Z999AA10

(No company information)

Extracted Supplier: "john@gmail.com" (fallback to email)
```

## Benefits

### Before
```
Supplier: "John Smith"
Supplier: "sarah@company.com"
Supplier: "Mike"
```
❌ Not useful for filtering/grouping
❌ Can't identify actual supplier company
❌ Multiple entries for same company

### After
```
Supplier: "Acme Manufacturing Co."
Supplier: "Global Products International"
Supplier: "ABC Textiles Inc."
```
✅ Actual company names
✅ Useful for filtering and reporting
✅ Consistent naming per company

## AI Prompt Enhancement

The AI now receives detailed instructions:

```
**IDENTIFY THE SUPPLIER COMPANY** using:
- Email signature/footer (company name, logo text, contact info)
- Sender's email domain (e.g., @acmecorp.com → "Acme Corp")
- Company name mentioned in body or signature
- "From" line company information
- Email footer contact information

Supplier Identification Priority:
1. Company name from email signature/footer (highest priority)
2. Company name from email domain
3. Sender's name if no company found

**ALWAYS try to identify supplier** - use company name from 
signature/footer, or derive from email domain if needed
```

## Fallback Logic

If AI cannot extract supplier, we fall back to:
1. First message sender's name
2. First message sender's email
3. "Unknown Supplier"

```typescript
const supplierName = extraction.supplier 
  || messages[0]?.author?.name 
  || messages[0]?.author?.email 
  || 'Unknown Supplier'
```

## Impact on Existing Data

**Note:** This only affects **new syncs**. Existing shipments will keep their current supplier names.

To update existing shipments, you would need to:
1. Clear the `scanned_conversations` table (force rescan)
2. Run sync with `force: true` flag
3. Or manually update supplier names in database

## Usage

### Automatic (Default)
Just run a sync - AI will automatically extract supplier names:
```bash
POST /api/front/scan
```

### View Results
Check the shipments table - supplier column now shows company names:
```
Acme Manufacturing Co.
Global Products International
ABC Textiles Inc.
Supreme Supplies
```

### Search/Filter
You can now search by actual company name:
```
Search: "Acme"
Results: All shipments from Acme Manufacturing Co.
```

## Testing

To verify supplier extraction is working:
1. Trigger a sync
2. Check console logs: `Supplier identified: [Company Name]`
3. View shipments table - supplier column should show company names
4. Search by company name in filters

## Future Enhancements

- [ ] Normalize supplier names (e.g., "ABC Inc." vs "ABC, Inc." vs "ABC Incorporated")
- [ ] Supplier database/autocomplete
- [ ] Merge duplicate suppliers
- [ ] Supplier performance analytics
- [ ] Preferred supplier tagging

## Summary

The supplier field now contains **actual company names** instead of just sender names/emails, making it much more useful for:
- Filtering shipments by supplier
- Reporting on supplier performance
- Grouping orders by company
- Supplier relationship management

**Much better supplier identification!** ✅
