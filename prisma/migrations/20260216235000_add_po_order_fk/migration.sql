-- Add foreign key constraint from purchase_orders to orders
-- This was intentionally deferred from the initial migration
-- Using Prisma's default referential actions: RESTRICT on delete, CASCADE on update

ALTER TABLE "purchase_orders" 
ADD CONSTRAINT "purchase_orders_order_number_fkey" 
FOREIGN KEY ("order_number") 
REFERENCES "orders"("order_number") 
ON DELETE RESTRICT ON UPDATE CASCADE;
