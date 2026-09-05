-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "password_hash" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider_refund_id" VARCHAR(255);
