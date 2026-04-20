-- CreateIndex
CREATE INDEX "affiliate_links_product_id_idx" ON "affiliate_links"("product_id");

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
