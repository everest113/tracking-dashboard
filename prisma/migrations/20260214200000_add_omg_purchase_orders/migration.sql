-- CreateTable
CREATE TABLE "omg_purchase_orders" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER,
    "po_number" VARCHAR(50) NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "omg_order_id" VARCHAR(50) NOT NULL,
    "omg_po_id" VARCHAR(50) NOT NULL,
    "order_name" VARCHAR(255),
    "customer_name" VARCHAR(255),
    "recipients" JSONB DEFAULT '[]',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,

    CONSTRAINT "omg_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "omg_purchase_orders_shipment_id_key" ON "omg_purchase_orders"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "omg_purchase_orders_omg_po_id_key" ON "omg_purchase_orders"("omg_po_id");

-- CreateIndex
CREATE INDEX "idx_omg_po_number" ON "omg_purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "idx_omg_order_number" ON "omg_purchase_orders"("order_number");

-- AddForeignKey
ALTER TABLE "omg_purchase_orders" ADD CONSTRAINT "omg_purchase_orders_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
