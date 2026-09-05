-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotency_key" VARCHAR(255);

-- CreateIndex
CREATE INDEX "payments_order_id_idempotency_key_idx" ON "payments"("order_id", "idempotency_key");
