-- Run this in Supabase SQL Editor if prisma db push hangs (e.g. with connection pooler).
-- Adds columns for order details form and user credit.

-- Users: credit fields
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "hasCredit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12,2);

-- Orders: order details fields
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "orderName" VARCHAR(255);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "dispatchType" VARCHAR(50);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "pickupEntity" VARCHAR(255);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "pickupName" VARCHAR(255);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "carrierName" VARCHAR(255);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "carrierAddress" TEXT;
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "carrierPhone" VARCHAR(50);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "carrierContactName" VARCHAR(255);
ALTER TABLE "Orders" ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(50);
