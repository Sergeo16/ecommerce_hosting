-- AlterTable
ALTER TABLE "affiliate_links" ADD COLUMN     "commission_amount" DECIMAL(12,2),
ADD COLUMN     "commission_percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "affiliate_override_amount" DECIMAL(12,2),
ADD COLUMN     "affiliate_override_percent" DECIMAL(5,2);
