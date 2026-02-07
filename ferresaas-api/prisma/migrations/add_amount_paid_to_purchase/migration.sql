-- AlterTable
ALTER TABLE "purchases" ADD COLUMN "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "payableId" TEXT;
