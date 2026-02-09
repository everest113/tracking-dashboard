# Supplier Tracking Enhancement

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- **Added `supplier` field** to the `Shipment` model to store the name of the supplier who sent the tracking number
- Field is optional (`String?`) and can store up to 255 characters

### 2. Tracking Extractor (`lib/tracking-extractor.ts`)
**Enhanced PO number detection:**
- Now accepts an **array of messages** from the entire conversation thread (not just the first message)
- Searches through **all messages** in the thread for PO numbers
- Checks both **message bodies AND subject lines** for PO references
- Looks for multiple PO variations: "PO", "P.O.", "Purchase Order", "Order #", "SO", "S.O."
- Builds comprehensive context from all messages in the thread for better extraction accuracy

### 3. Front Scan Route (`app/api/front/scan/route.ts`)
**Updated conversation processing:**
- Fetches **all messages** from each conversation (not just the first one)
- Prepares all messages with subject, body, sender email, and sender name
- Passes the entire message thread to the extraction function
- **Captures supplier name** from the conversation (uses first message sender's name or email)
- Stores the supplier name when creating shipments in the database

## How It Works

1. **Scan initiates** → Fetches conversations from Front "Suppliers" inbox
2. **For each conversation:**
   - Retrieves ALL messages in the thread
   - Builds message context array with subjects, bodies, and sender info
3. **AI extraction:**
   - OpenAI searches through all messages for tracking numbers
   - Looks for PO numbers in ANY message (not just the one with tracking)
   - Checks both body and subject lines
4. **Shipment creation:**
   - Stores tracking number, carrier, PO number (if found)
   - **Stores supplier name** (sender of the first message)
   - Falls back to auto-generated PO if none found in thread

## Benefits

- **More accurate PO matching** - searches entire conversation thread
- **Subject line support** - PO numbers in email subjects are now detected
- **Supplier tracking** - know who sent each tracking number
- **Better context** - AI has full conversation context for extraction

## Database Migration

The `supplier` field has been added to the database using `prisma db push`.
