-- Add in_hands_date to orders table (synced from OMG Order detail API)
ALTER TABLE "orders" ADD COLUMN "in_hands_date" TIMESTAMP(3);

-- Create index for filtering/sorting by in-hands date
CREATE INDEX "idx_order_in_hands_date" ON "orders"("in_hands_date");
