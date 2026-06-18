import { DISPATCH_TYPE_INTERNATIONAL_CARRIER } from '@/lib/order-details-constants';

/** USD minimum charge covering up to this many pounds (inclusive). */
export const INTERNATIONAL_CARRIER_INCLUDED_LBS = 20;

/** USD base fee for the first INCLUDED_LBS pounds (when total weight > 0). */
export const INTERNATIONAL_CARRIER_BASE_FEE_USD = 15;

/** USD per pound beyond INCLUDED_LBS. */
export const INTERNATIONAL_CARRIER_PER_EXTRA_LB_USD = 0.5;

/**
 * Optional hard cap on surcharge (USD). Set high to effectively disable; adjust if business rules change.
 */
export const INTERNATIONAL_CARRIER_MAX_SURCHARGE_USD = 10_000;

export type InternationalCarrierSurchargeBreakdown = {
  totalWeightLbs: number;
  /** Same as totalWeightLbs when weight > 0; otherwise 0. */
  billableWeightLbs: number;
  extraLbs: number;
  feeUsd: number;
};

/**
 * Total shipping weight: sum of (weight per unit in lb × quantity) for each line.
 */
export function computeTotalOrderWeightLbs(
  items: ReadonlyArray<{ weightPoundsPerUnit?: number | null; quantity?: number | null }>
): number {
  let total = 0;
  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const w = item.weightPoundsPerUnit;
    const perUnit = typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : 0;
    total += perUnit * qty;
  }
  return Math.round(total * 1000) / 1000;
}

/**
 * Miami international-carrier delivery fee:
 * - $15 minimum for up to 20 lb total order weight
 * - $0.50 per additional lb beyond 20 lb
 * - If total weight is 0, fee is 0 (caller may show a warning about missing weights)
 */
export function computeInternationalCarrierSurchargeUsd(
  totalWeightLbs: number
): InternationalCarrierSurchargeBreakdown {
  const w = typeof totalWeightLbs === 'number' && Number.isFinite(totalWeightLbs) ? totalWeightLbs : 0;
  if (w <= 0) {
    return {
      totalWeightLbs: 0,
      billableWeightLbs: 0,
      extraLbs: 0,
      feeUsd: 0,
    };
  }

  const extraLbs = Math.max(0, w - INTERNATIONAL_CARRIER_INCLUDED_LBS);
  const variable = extraLbs * INTERNATIONAL_CARRIER_PER_EXTRA_LB_USD;
  const raw = INTERNATIONAL_CARRIER_BASE_FEE_USD + variable;
  const feeUsd = Math.min(
    INTERNATIONAL_CARRIER_MAX_SURCHARGE_USD,
    Math.round(raw * 100) / 100
  );

  return {
    totalWeightLbs: Math.round(w * 1000) / 1000,
    billableWeightLbs: Math.round(w * 1000) / 1000,
    extraLbs: Math.round(extraLbs * 1000) / 1000,
    feeUsd,
  };
}

/** Line subtotal from client payload (prefers totalPrice per line). */
export function computeLineSubtotalFromOrderItems(
  items: ReadonlyArray<{
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
  }>
): number {
  let sum = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const totalPrice = Number(item.totalPrice);
    if (Number.isFinite(totalPrice)) {
      sum += Math.round(totalPrice * 100) / 100;
      continue;
    }
    const unit = Number(item.unitPrice);
    if (Number.isFinite(unit)) {
      sum += Math.round(unit * qty * 100) / 100;
    }
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Expected order total: line subtotal + international carrier surcharge when applicable.
 */
export function computeExpectedOrderTotalUsd(
  items: ReadonlyArray<{
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    weightPoundsPerUnit?: number | null;
  }>,
  dispatchType: string | null | undefined
): { lineSubtotalUsd: number; surchargeUsd: number; totalWeightLbs: number; expectedTotalUsd: number } {
  const lineSubtotalUsd = computeLineSubtotalFromOrderItems(items);
  const totalWeightLbs = computeTotalOrderWeightLbs(items);
  const surchargeUsd =
    dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER
      ? computeInternationalCarrierSurchargeUsd(totalWeightLbs).feeUsd
      : 0;
  const expectedTotalUsd = Math.round((lineSubtotalUsd + surchargeUsd) * 100) / 100;
  return { lineSubtotalUsd, surchargeUsd, totalWeightLbs, expectedTotalUsd };
}
