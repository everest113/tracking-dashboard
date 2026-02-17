-- Move customer thread data from shipment level to order level
-- This migration:
-- 1. Adds thread fields to orders table
-- 2. Migrates existing data from shipment_customer_threads
-- 3. Drops the shipment_customer_threads table

-- Step 1: Add thread columns to orders table
ALTER TABLE "orders" ADD COLUMN "front_conversation_id" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN "thread_match_status" "ThreadMatchStatus" NOT NULL DEFAULT 'not_found';
ALTER TABLE "orders" ADD COLUMN "thread_confidence_score" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "thread_email_matched" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "thread_order_in_subject" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "thread_order_in_body" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "thread_days_since_message" INTEGER;
ALTER TABLE "orders" ADD COLUMN "thread_matched_email" VARCHAR(255);
ALTER TABLE "orders" ADD COLUMN "thread_conversation_subject" TEXT;
ALTER TABLE "orders" ADD COLUMN "thread_reviewed_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "thread_reviewed_by" VARCHAR(100);

-- Step 2: Migrate data from shipment_customer_threads to orders
-- Join through shipments -> omg_purchase_orders -> orders
UPDATE "orders" o
SET 
  front_conversation_id = sct.front_conversation_id,
  thread_match_status = sct.match_status,
  thread_confidence_score = sct.confidence_score,
  thread_email_matched = sct.email_matched,
  thread_order_in_subject = sct.order_in_subject,
  thread_order_in_body = sct.order_in_body,
  thread_days_since_message = sct.days_since_last_message,
  thread_matched_email = sct.matched_email,
  thread_conversation_subject = sct.conversation_subject,
  thread_reviewed_at = sct.reviewed_at,
  thread_reviewed_by = sct.reviewed_by
FROM "shipment_customer_threads" sct
JOIN "shipments" s ON s.id = sct.shipment_id
JOIN "omg_purchase_orders" omg ON omg.po_number = s.po_number
WHERE o.order_number = omg.order_number;

-- Step 3: Create indexes
CREATE INDEX "idx_order_conversation" ON "orders"("front_conversation_id");
CREATE INDEX "idx_order_thread_status" ON "orders"("thread_match_status");

-- Step 4: Remove the relation from shipments (just the relation, column stays for backwards compat)
-- No action needed - Prisma will handle this

-- Step 5: Drop the old table
DROP TABLE "shipment_customer_threads";
