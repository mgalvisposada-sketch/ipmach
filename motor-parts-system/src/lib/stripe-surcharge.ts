/**
 * Gross-up so the business receives `originalUsd` after the assumed card fee (4.4% + $0.30).
 * totalFinal = (original + fixed) / (1 - percent)
 */
export const STRIPE_SURCHARGE_PERCENT = 0.044;
export const STRIPE_SURCHARGE_FIXED_USD = 0.3;

export type StripeGrossUpResult = {
  originalUsd: number;
  totalFinalUsd: number;
  surchargeUsd: number;
};

export function computeStripeGrossUpUsd(originalUsd: number): StripeGrossUpResult {
  const safe = Number.isFinite(originalUsd) && originalUsd > 0 ? originalUsd : 0;
  const totalFinalUsd = (safe + STRIPE_SURCHARGE_FIXED_USD) / (1 - STRIPE_SURCHARGE_PERCENT);
  const roundedTotal = Math.round(totalFinalUsd * 100) / 100;
  const surchargeUsd = Math.round((roundedTotal - safe) * 100) / 100;
  return {
    originalUsd: safe,
    totalFinalUsd: roundedTotal,
    surchargeUsd,
  };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
