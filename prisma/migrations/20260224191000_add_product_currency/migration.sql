-- CreateEnum
CREATE TYPE "SellerPlanSlug" AS ENUM ('FREE', 'PRO', 'ELITE');

-- CreateEnum
CREATE TYPE "SellerSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- CreateEnum
CREATE TYPE "AdPlacementType" AS ENUM ('PRODUCT_SPOTLIGHT', 'CATEGORY_TOP', 'BANNER_HOME', 'SEARCH_TOP');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'CLOSED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'XOF';

-- CreateTable
CREATE TABLE "seller_subscription_plans" (
    "id" TEXT NOT NULL,
    "slug" "SellerPlanSlug" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "commission_percent_override" DECIMAL(5,2),
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_subscriptions" (
    "id" TEXT NOT NULL,
    "company_profile_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SellerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "stripe_subscription_id" TEXT,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "company_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement_type" "AdPlacementType" NOT NULL,
    "target_category_id" TEXT,
    "target_product_id" TEXT,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "budget_total" DECIMAL(12,2) NOT NULL,
    "bid_cpc" DECIMAL(10,4) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points_per_xof" DECIMAL(10,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_loyalty_points" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_key" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_levels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_trees" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "referral_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_transactions" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_profile_id" TEXT,
    "document_type" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "raised_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "refund_amount" DECIMAL(12,2),
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_two_factors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "backup_codes" TEXT[],
    "enabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_two_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sales" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "promo_price" DECIMAL(12,2) NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "max_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_id" TEXT,
    "platform_percent" DECIMAL(5,2) NOT NULL,
    "conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscription_plans_slug_key" ON "seller_subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seller_subscriptions_company_profile_id_key" ON "seller_subscriptions"("company_profile_id");

-- CreateIndex
CREATE INDEX "seller_subscriptions_status_idx" ON "seller_subscriptions"("status");

-- CreateIndex
CREATE INDEX "ad_campaigns_company_profile_id_idx" ON "ad_campaigns"("company_profile_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_placement_type_idx" ON "ad_campaigns"("status", "placement_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_loyalty_points_user_id_key" ON "user_loyalty_points"("user_id");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_key_key" ON "user_badges"("user_id", "badge_key");

-- CreateIndex
CREATE UNIQUE INDEX "user_levels_user_id_key" ON "user_levels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_trees_referred_id_key" ON "referral_trees"("referred_id");

-- CreateIndex
CREATE INDEX "referral_trees_referrer_id_idx" ON "referral_trees"("referrer_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transactions_order_id_key" ON "escrow_transactions"("order_id");

-- CreateIndex
CREATE INDEX "kyc_submissions_user_id_idx" ON "kyc_submissions"("user_id");

-- CreateIndex
CREATE INDEX "kyc_submissions_status_idx" ON "kyc_submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- CreateIndex
CREATE INDEX "disputes_order_id_idx" ON "disputes"("order_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_two_factors_user_id_key" ON "user_two_factors"("user_id");

-- CreateIndex
CREATE INDEX "flash_sales_product_id_idx" ON "flash_sales"("product_id");

-- CreateIndex
CREATE INDEX "flash_sales_end_at_idx" ON "flash_sales"("end_at");

-- CreateIndex
CREATE INDEX "commission_rules_scope_scope_id_idx" ON "commission_rules"("scope", "scope_id");

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_subscriptions" ADD CONSTRAINT "seller_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "seller_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_points" ADD CONSTRAINT "user_loyalty_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_points" ADD CONSTRAINT "user_loyalty_points_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_trees" ADD CONSTRAINT "referral_trees_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_trees" ADD CONSTRAINT "referral_trees_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_two_factors" ADD CONSTRAINT "user_two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
