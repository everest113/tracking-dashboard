-- Add foreign key constraint from purchase_orders to orders
-- This was intentionally deferred from the initial migration

ALTER TABLE "purchase_orders" 
ADD CONSTRAINT "purchase_orders_order_number_fkey" 
FOREIGN KEY ("order_number") 
REFERENCES "orders"("order_number") 
ON DELETE CASCADE ON UPDATE CASCADE;
