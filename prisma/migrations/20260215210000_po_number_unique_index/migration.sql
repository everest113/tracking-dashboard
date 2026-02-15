-- DropForeignKey
ALTER TABLE "omg_purchase_orders" DROP CONSTRAINT "omg_purchase_orders_shipment_id_fkey";

-- DropIndex
DROP INDEX "omg_purchase_orders_shipment_id_key";

-- DropIndex (will be recreated as unique)
DROP INDEX "idx_omg_po_number";

-- CreateIndex (unique instead of regular index)
CREATE UNIQUE INDEX "omg_purchase_orders_po_number_key" ON "omg_purchase_orders"("po_number");

-- Recreate the po_number index for lookups
CREATE INDEX "idx_omg_po_number" ON "omg_purchase_orders"("po_number");
