-- CreateEnum
CREATE TYPE "OrderComputedStatus" AS ENUM ('pending', 'in_transit', 'partially_delivered', 'delivered', 'exception');

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "order_name" VARCHAR(255),
    "customer_name" VARCHAR(255),
    "customer_email" VARCHAR(255),
    "omg_order_id" VARCHAR(50) NOT NULL,
    "computed_status" "OrderComputedStatus" NOT NULL DEFAULT 'pending',
    "shipment_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "in_transit_count" INTEGER NOT NULL DEFAULT 0,
    "pending_count" INTEGER NOT NULL DEFAULT 0,
    "exception_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_order_status" ON "orders"("computed_status");

-- CreateIndex
CREATE INDEX "idx_order_customer_email" ON "orders"("customer_email");

-- CreateIndex
CREATE INDEX "idx_order_created" ON "orders"("created_at" DESC);
