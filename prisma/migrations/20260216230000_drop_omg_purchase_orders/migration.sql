-- Migration: Drop deprecated omg_purchase_orders table
-- Data has been migrated to purchase_orders + orders tables

-- Drop the old table
DROP TABLE IF EXISTS "omg_purchase_orders";
