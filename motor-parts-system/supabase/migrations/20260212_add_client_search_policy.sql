-- Add client search policy columns to Users (for role=client only)
-- searchAllowed: false = blocked/on hold. searchQuotaLimit: null = unlimited; number = max searches since last order.

ALTER TABLE "Users"
ADD COLUMN IF NOT EXISTS "searchAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "searchQuotaLimit" INTEGER NULL;

COMMENT ON COLUMN "Users"."searchAllowed" IS 'If false, client cannot perform reference searches (blocked/on hold)';
COMMENT ON COLUMN "Users"."searchQuotaLimit" IS 'Max searches since last order; null = unlimited. Resets when client places an order';
