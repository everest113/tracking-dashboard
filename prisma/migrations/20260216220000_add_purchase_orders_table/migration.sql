-- Migration: Add purchase_orders table and update orders for direct OMG sync
-- This decouples order sync from shipments

-- Add new fields to orders table for direct OMG sync
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "omg_approval_status" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "omg_operations_status" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "omg_created_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "po_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3);

-- Create purchase_orders table (replaces omg_purchase_orders for new sync)
CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" SERIAL NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    
    -- OMG identifiers
    "omg_po_id" VARCHAR(50) NOT NULL,
    "omg_order_id" VARCHAR(50) NOT NULL,
    
    -- Supplier info
    "supplier_name" VARCHAR(255),
    
    -- Dates from OMG
    "ship_date" TIMESTAMP(3),
    "in_hands_date" TIMESTAMP(3),
    
    -- Operations status from OMG (e.g., "In Production", "Shipped")
    "operations_status" VARCHAR(50),
    
    -- Tracking numbers from OMG (JSON array of {number, carrier})
    "tracking_numbers" JSONB DEFAULT '[]',
    
    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on po_number
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- Index for order lookup
CREATE INDEX IF NOT EXISTS "idx_po_order_number" ON "purchase_orders"("order_number");

-- Index for OMG ID lookup
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_omg_po_id_key" ON "purchase_orders"("omg_po_id");

-- Foreign key to orders (order_number)
-- Note: We don't add FK constraint yet because orders might not exist during migration
-- The application layer handles this relationship

-- Add index on orders.omg_approval_status for filtering
CREATE INDEX IF NOT EXISTS "idx_order_approval_status" ON "orders"("omg_approval_status");

-- Add index on orders.last_synced_at
CREATE INDEX IF NOT EXISTS "idx_order_last_synced" ON "orders"("last_synced_at");
