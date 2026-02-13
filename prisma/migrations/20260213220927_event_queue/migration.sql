-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "event_queue" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER DEFAULT 5,
    "dedupe_key" TEXT,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_error" TEXT,

    CONSTRAINT "event_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_consumer_offsets" (
    "id" SERIAL NOT NULL,
    "consumer" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "last_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_consumer_offsets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_queue_dedupe_key_key" ON "event_queue"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "event_consumer_offsets_consumer_topic_key" ON "event_consumer_offsets"("consumer", "topic");
