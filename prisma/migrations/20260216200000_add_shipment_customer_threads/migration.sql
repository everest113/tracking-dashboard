-- CreateEnum for match status
CREATE TYPE "ThreadMatchStatus" AS ENUM ('auto_matched', 'pending_review', 'manually_linked', 'rejected', 'not_found');

-- CreateTable: shipment_customer_threads
-- Links shipments to Front customer conversation threads for notifications.
-- Confidence scoring determines auto-match vs manual review.
CREATE TABLE "shipment_customer_threads" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "front_conversation_id" VARCHAR(100) NOT NULL,
    
    -- Confidence scoring
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "match_status" "ThreadMatchStatus" NOT NULL DEFAULT 'pending_review',
    
    -- Scoring breakdown (for debugging/audit)
    "email_matched" BOOLEAN NOT NULL DEFAULT false,
    "po_in_subject" BOOLEAN NOT NULL DEFAULT false,
    "po_in_body" BOOLEAN NOT NULL DEFAULT false,
    "days_since_last_message" INTEGER,
    
    -- Metadata
    "matched_email" VARCHAR(255),
    "conversation_subject" TEXT,
    
    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" VARCHAR(100),

    CONSTRAINT "shipment_customer_threads_pkey" PRIMARY KEY ("id")
);

-- Each shipment can only have one customer thread link
CREATE UNIQUE INDEX "shipment_customer_threads_shipment_id_key" ON "shipment_customer_threads"("shipment_id");

-- Index for finding threads by conversation
CREATE INDEX "idx_sct_conversation" ON "shipment_customer_threads"("front_conversation_id");

-- Index for finding pending reviews
CREATE INDEX "idx_sct_status" ON "shipment_customer_threads"("match_status");

-- Index for confidence-based queries
CREATE INDEX "idx_sct_confidence" ON "shipment_customer_threads"("confidence_score" DESC);

-- Add foreign key to shipments
ALTER TABLE "shipment_customer_threads" ADD CONSTRAINT "shipment_customer_threads_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
