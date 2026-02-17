-- Fix tracking_numbers column to be NOT NULL (matches schema.prisma)
-- First update any NULL values to empty array
UPDATE "purchase_orders" SET "tracking_numbers" = '[]' WHERE "tracking_numbers" IS NULL;

-- Then alter the column to be NOT NULL
ALTER TABLE "purchase_orders" ALTER COLUMN "tracking_numbers" SET NOT NULL;
