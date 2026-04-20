-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "guest_email" TEXT,
ADD COLUMN     "guest_first_name" TEXT,
ADD COLUMN     "guest_last_name" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
