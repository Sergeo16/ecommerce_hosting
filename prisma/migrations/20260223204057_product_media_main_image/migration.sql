-- AlterTable
ALTER TABLE "products" ADD COLUMN     "main_image_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "video_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
