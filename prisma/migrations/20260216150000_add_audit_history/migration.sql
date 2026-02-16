-- CreateTable
CREATE TABLE "audit_history" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "actor" VARCHAR(100) NOT NULL DEFAULT 'system',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(50) NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_history"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "audit_history"("action");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_type_action" ON "audit_history"("entity_type", "action");
