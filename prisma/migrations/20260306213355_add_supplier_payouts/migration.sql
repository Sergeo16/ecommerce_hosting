-- CreateEnum
CREATE TYPE "SupplierPayoutStatus" AS ENUM ('APPROVED', 'ON_HOLD', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "supplier_payouts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "company_profile_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "SupplierPayoutStatus" NOT NULL DEFAULT 'APPROVED',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payouts_order_id_idx" ON "supplier_payouts"("order_id");

-- CreateIndex
CREATE INDEX "supplier_payouts_company_profile_id_idx" ON "supplier_payouts"("company_profile_id");

-- AddForeignKey
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payouts" ADD CONSTRAINT "supplier_payouts_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
