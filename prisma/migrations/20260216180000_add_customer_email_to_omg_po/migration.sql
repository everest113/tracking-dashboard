-- Add customer_email column to omg_purchase_orders
-- This captures the customer's email from OMG orders for Front thread matching.
-- OMG stores emails as an array; we capture the primary (first) email.

ALTER TABLE "omg_purchase_orders" ADD COLUMN "customer_email" VARCHAR(255);

-- Index for email lookups (used by Front thread matching)
CREATE INDEX "idx_omg_customer_email" ON "omg_purchase_orders"("customer_email");
