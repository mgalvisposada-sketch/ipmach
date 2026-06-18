/**
 * Calculate price with profit divisor
 * @param basePrice - Base price from source
 * @param profitValue - Profit divisor (e.g., 0.6 means price / 0.6)
 * @returns Final price with profit applied
 * 
 * Formula: finalPrice = basePrice / profitValue
 * Example: basePrice = 100, profitValue = 0.6
 *   finalPrice = 100 / 0.6 = 166.67
 */
export function calculatePriceWithProfit(
  basePrice: number,
  profitValue: number
): number {
  if (profitValue <= 0 || profitValue >= 1) {
    // Invalid divisor, return base price
    return basePrice;
  }
  return Math.round(basePrice / profitValue);
}

/**
 * Calculate base price from final price with profit
 * @param finalPrice - Price with profit applied
 * @param profitPercent - Profit percentage
 * @returns Base price without profit
 */
export function calculateBasePrice(
  finalPrice: number,
  profitPercent: number
): number {
  if (profitPercent <= 0) return finalPrice;
  if (profitPercent >= 100) {
    return Math.round(finalPrice / 2);
  }
  const divisor = 1 / (1 - profitPercent / 100);
  return Math.round(finalPrice / divisor);
}

