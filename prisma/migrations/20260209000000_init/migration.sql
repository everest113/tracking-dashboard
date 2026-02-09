-- CreateTable
CREATE TABLE "scanned_conversations" (
    "id" SERIAL NOT NULL,
    "conversation_id" VARCHAR(255) NOT NULL,
    "subject" TEXT,
    "shipments_found" INTEGER NOT NULL DEFAULT 0,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scanned_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "po_number" VARCHAR(255),
    "tracking_number" VARCHAR(255) NOT NULL,
    "carrier" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "origin" TEXT,
    "destination" TEXT,
    "shipped_date" TIMESTAMP(3),
    "estimated_delivery" TIMESTAMP(3),
    "delivered_date" TIMESTAMP(3),
    "last_checked" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "supplier" VARCHAR(255),
    "front_conversation_id" VARCHAR(255),
    "ship24_tracker_id" VARCHAR(255),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_history" (
    "id" SERIAL NOT NULL,
    "conversations_processed" INTEGER NOT NULL DEFAULT 0,
    "conversations_already_scanned" INTEGER NOT NULL DEFAULT 0,
    "shipments_added" INTEGER NOT NULL DEFAULT 0,
    "shipments_skipped" INTEGER NOT NULL DEFAULT 0,
    "conversations_with_no_tracking" INTEGER NOT NULL DEFAULT 0,
    "batch_size" INTEGER NOT NULL DEFAULT 10,
    "limit" INTEGER NOT NULL DEFAULT 100,
    "duration_ms" INTEGER,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'success',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "status" VARCHAR(50),
    "location" TEXT,
    "message" TEXT,
    "event_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scanned_conversations_conversation_id_key" ON "scanned_conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_conversation_id" ON "scanned_conversations"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_ship24_tracker_id_key" ON "shipments"("ship24_tracker_id");

-- CreateIndex
CREATE INDEX "idx_front_conversation" ON "shipments"("front_conversation_id");

-- CreateIndex
CREATE INDEX "idx_po_number" ON "shipments"("po_number");

-- CreateIndex
CREATE INDEX "idx_status" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "idx_ship24_tracker" ON "shipments"("ship24_tracker_id");

-- CreateIndex
CREATE INDEX "idx_started_at" ON "sync_history"("started_at");

-- CreateIndex
CREATE INDEX "idx_shipment_id" ON "tracking_events"("shipment_id");

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
