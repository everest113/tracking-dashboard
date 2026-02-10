-- Add error tracking and Ship24 metadata
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "ship24_status" VARCHAR(100);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "ship24_last_update" TIMESTAMP(3);
