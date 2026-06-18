/**
 * Conversion Calculator
 * Calcula métricas de conversión entre búsquedas y órdenes de compra
 */

interface OrderItem {
  reference: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  hasStock?: boolean;
  location?: string;
  description?: string;
}

interface Order {
  id: number;
  clientId: number;
  items: OrderItem[] | any; // JSON field
  status: string;
  totalAmount: number;
  createdAt: Date;
}

interface SearchLog {
  id: number;
  searchTerm: string;
  timestamp: Date;
  userId: number | null;
  hasStock: boolean;
  resultCount: number;
}

export interface ConversionMetrics {
  reference: string;
  totalSearches: number;
  uniqueClients: number;
  totalOrders: number;
  conversionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgSearchesPerClient: number;
}

/**
 * Parsea el campo JSON items de una orden
 */
function parseOrderItems(items: any): OrderItem[] {
  if (Array.isArray(items)) {
    return items;
  }
  if (typeof items === 'string') {
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normalizes a part number/reference for comparison and external API calls.
 * "1P 8116", "1P8116", "1P-8116", "9X1439", "9x1439" → same canonical form (no spaces, no hyphens, uppercase).
 */
export function normalizeReference(ref: string): string {
  if (ref == null || typeof ref !== 'string') return '';
  return ref
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

/**
 * Calcula métricas de conversión para una referencia específica
 */
export function calculateConversionForReference(
  reference: string,
  searches: SearchLog[],
  orders: Order[]
): ConversionMetrics {
  const normalizedRef = normalizeReference(reference);

  // 1. Contar búsquedas de esta referencia
  const referenceSearches = searches.filter(
    (s) => normalizeReference(s.searchTerm) === normalizedRef
  );
  const totalSearches = referenceSearches.length;

  // 2. Obtener clientes únicos que buscaron
  const uniqueClients = new Set(
    referenceSearches.filter((s) => s.userId !== null).map((s) => s.userId)
  );
  const uniqueClientsCount = uniqueClients.size;

  // 3. Encontrar órdenes que contienen esta referencia
  const ordersWithReference = orders.filter((order) => {
    const items = parseOrderItems(order.items);
    return items.some((item) => normalizeReference(item.reference) === normalizedRef);
  });

  const totalOrders = ordersWithReference.length;

  // 4. Calcular revenue total de esta referencia
  let totalRevenue = 0;
  ordersWithReference.forEach((order) => {
    const items = parseOrderItems(order.items);
    items.forEach((item) => {
      if (normalizeReference(item.reference) === normalizedRef) {
        totalRevenue += item.totalPrice || 0;
      }
    });
  });

  // 5. Calcular métricas
  const conversionRate = totalSearches > 0 ? (totalOrders / totalSearches) * 100 : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const avgSearchesPerClient = uniqueClientsCount > 0 ? totalSearches / uniqueClientsCount : 0;

  return {
    reference: reference,
    totalSearches,
    uniqueClients: uniqueClientsCount,
    totalOrders,
    conversionRate: Math.round(conversionRate * 100) / 100, // 2 decimales
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    avgSearchesPerClient: Math.round(avgSearchesPerClient * 100) / 100,
  };
}

/**
 * Calcula métricas de conversión para múltiples referencias.
 * Agrupa por referencia normalizada (9X1439 = 9x1439 = 9X 1439).
 */
export function calculateConversionForMultipleReferences(
  searches: SearchLog[],
  orders: Order[]
): ConversionMetrics[] {
  // Unique references by NORMALIZED form so 9X1439 and 9x1439 count as one
  const uniqueNormalizedRefs = new Set<string>(
    searches.map((s) => normalizeReference(s.searchTerm)).filter(Boolean)
  );

  const metrics: ConversionMetrics[] = [];

  uniqueNormalizedRefs.forEach((normalizedRef) => {
    // Pass normalized form so all metrics use same canonical reference
    const refMetrics = calculateConversionForReference(normalizedRef, searches, orders);
    if (refMetrics.totalSearches > 0) {
      metrics.push(refMetrics);
    }
  });

  return metrics;
}

/**
 * Filtra métricas por criterios mínimos
 */
export function filterMetricsByThreshold(
  metrics: ConversionMetrics[],
  minSearches: number = 1,
  minConversionRate: number = 0
): ConversionMetrics[] {
  return metrics.filter(
    (m) => m.totalSearches >= minSearches && m.conversionRate >= minConversionRate
  );
}

/**
 * Ordena métricas por diferentes criterios
 */
export function sortMetrics(
  metrics: ConversionMetrics[],
  sortBy: 'searches' | 'conversion' | 'revenue' | 'orders' = 'searches',
  order: 'asc' | 'desc' = 'desc'
): ConversionMetrics[] {
  const sorted = [...metrics];

  sorted.sort((a, b) => {
    let valueA: number, valueB: number;

    switch (sortBy) {
      case 'searches':
        valueA = a.totalSearches;
        valueB = b.totalSearches;
        break;
      case 'conversion':
        valueA = a.conversionRate;
        valueB = b.conversionRate;
        break;
      case 'revenue':
        valueA = a.totalRevenue;
        valueB = b.totalRevenue;
        break;
      case 'orders':
        valueA = a.totalOrders;
        valueB = b.totalOrders;
        break;
      default:
        valueA = a.totalSearches;
        valueB = b.totalSearches;
    }

    return order === 'desc' ? valueB - valueA : valueA - valueB;
  });

  return sorted;
}

/**
 * Calcula estadísticas agregadas del período
 */
export function calculatePeriodStats(
  metrics: ConversionMetrics[]
): {
  totalSearches: number;
  totalOrders: number;
  totalRevenue: number;
  avgConversionRate: number;
  totalReferences: number;
  highConversionReferences: number; // >50%
} {
  const totalSearches = metrics.reduce((sum, m) => sum + m.totalSearches, 0);
  const totalOrders = metrics.reduce((sum, m) => sum + m.totalOrders, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.totalRevenue, 0);
  const avgConversionRate =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.conversionRate, 0) / metrics.length
      : 0;
  const highConversionReferences = metrics.filter((m) => m.conversionRate > 50).length;

  return {
    totalSearches,
    totalOrders,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgConversionRate: Math.round(avgConversionRate * 100) / 100,
    totalReferences: metrics.length,
    highConversionReferences,
  };
}
