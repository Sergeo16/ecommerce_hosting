-- AlterTable
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "city" TEXT;
ALTER TABLE "users" ADD COLUMN "address_lat" DECIMAL(10,7);
ALTER TABLE "users" ADD COLUMN "address_lng" DECIMAL(10,7);
