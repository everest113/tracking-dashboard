-- Add followup_date to orders table (synced from OMG Order detail API)
ALTER TABLE "orders" ADD COLUMN "followup_date" TIMESTAMP(3);

-- Create index for filtering/sorting
CREATE INDEX "idx_order_followup_date" ON "orders"("followup_date");
