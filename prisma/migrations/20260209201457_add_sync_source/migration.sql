-- AlterTable
ALTER TABLE "sync_history" ADD COLUMN "source" VARCHAR(50) NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE INDEX "idx_source" ON "sync_history"("source");
