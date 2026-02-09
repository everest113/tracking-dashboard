-- Add ship24_tracker_id column to shipments table
ALTER TABLE "shipments" ADD COLUMN "ship24_tracker_id" VARCHAR(255);

-- Create unique constraint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_ship24_tracker_id_key" UNIQUE ("ship24_tracker_id");

-- Create index for efficient lookups
CREATE INDEX "idx_ship24_tracker" ON "shipments"("ship24_tracker_id");
