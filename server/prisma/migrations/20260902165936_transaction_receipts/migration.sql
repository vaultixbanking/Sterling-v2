-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receiptIssuedAt" TIMESTAMP(3),
ADD COLUMN     "receiptRef" TEXT,
ADD COLUMN     "receiptToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receiptToken_key" ON "transactions"("receiptToken");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receiptRef_key" ON "transactions"("receiptRef");
