-- AlterTable
ALTER TABLE "withdrawal_pins" ADD COLUMN     "pinCipher" TEXT,
ADD COLUMN     "revealedAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_pins_shareToken_key" ON "withdrawal_pins"("shareToken");
