/**
 * Stock Recommender
 * Sistema de recomendaciones para identificar productos candidatos a stock propio.
 *
 * CÓMO SE DEFINE LA PRIORIDAD (Alta / Media / Considerar):
 *
 * 1. Se calcula un SCORE de 0 a 100 con 4 factores y pesos:
 *    - Conversión (40%): % de búsquedas que se convirtieron en orden
 *    - Volumen (30%): cantidad de búsquedas en el período
 *    - Tendencia (20%): si la demanda va subiendo, estable o bajando
 *    - Revenue (10%): ingresos totales en USD generados por esa referencia
 *
 * 2. Cada factor aporta un sub-score 0-100; se multiplica por su peso y se suma.
 *
 * 3. Prioridad según el score final:
 *    - Score >= 85 → Prioridad Alta (candidato prioritario)
 *    - Score >= 70 → Prioridad Media (candidato viable, "recomendado")
 *    - Score >= 50 → Considerar (bajo monitoreo)
 *    - Score < 50  → No recomendado
 *
 * 4. "Recomendado para stock propio" = score >= 70 (Prioridad Alta o Media).
 */

import { ConversionMetrics } from './conversion-calculator';

export interface StockRecommendation {
  reference: string;
  recommended: boolean;
  score: number; // 0-100
  priority: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  warnings: string[];
  estimatedMonthlyDemand: number;
  estimatedMonthlyRevenue: number;
}

export interface RecommendationCriteria {
  minConversionRate: number; // Default: 30%
  minSearchVolume: number; // Default: 20
  minRevenue: number; // Default: 500 (USD)
  weightConversion: number; // Default: 40%
  weightVolume: number; // Default: 30%
  weightTrend: number; // Default: 20%
  weightRevenue: number; // Default: 10%
}

const DEFAULT_CRITERIA: RecommendationCriteria = {
  minConversionRate: 30,
  minSearchVolume: 20,
  minRevenue: 500, // 500 USD
  weightConversion: 40,
  weightVolume: 30,
  weightTrend: 20,
  weightRevenue: 10,
};

/**
 * Evalúa si una referencia es candidata a stock propio
 */
export function evaluateStockRecommendation(
  metrics: ConversionMetrics,
  trendDirection: 'up' | 'down' | 'stable' = 'stable',
  criteria: Partial<RecommendationCriteria> = {}
): StockRecommendation {
  const config = { ...DEFAULT_CRITERIA, ...criteria };
  const reasons: string[] = [];
  const warnings: string[] = [];

  let score = 0;

  // 1. Evaluar conversión (peso configurable, default 40%)
  const conversionScore = evaluateConversion(
    metrics.conversionRate,
    config.minConversionRate,
    reasons,
    warnings
  );
  score += (conversionScore * config.weightConversion) / 100;

  // 2. Evaluar volumen de búsquedas (peso configurable, default 30%)
  const volumeScore = evaluateVolume(
    metrics.totalSearches,
    config.minSearchVolume,
    reasons,
    warnings
  );
  score += (volumeScore * config.weightVolume) / 100;

  // 3. Evaluar tendencia (peso configurable, default 20%)
  const trendScore = evaluateTrend(trendDirection, reasons, warnings);
  score += (trendScore * config.weightTrend) / 100;

  // 4. Evaluar revenue (peso configurable, default 10%)
  const revenueScore = evaluateRevenue(
    metrics.totalRevenue,
    config.minRevenue,
    reasons,
    warnings
  );
  score += (revenueScore * config.weightRevenue) / 100;

  // 5. Evaluar número de clientes únicos
  evaluateClientBase(metrics.uniqueClients, reasons, warnings);

  // Determinar prioridad
  let priority: 'high' | 'medium' | 'low' | 'none';
  const recommended = score >= 70;

  if (score >= 85) {
    priority = 'high';
    reasons.push('Score muy alto: candidato prioritario para stock propio');
  } else if (score >= 70) {
    priority = 'medium';
    reasons.push('Score bueno: candidato viable para stock propio');
  } else if (score >= 50) {
    priority = 'low';
    reasons.push('Score moderado: considerar bajo monitoreo adicional');
  } else {
    priority = 'none';
    warnings.push('Score bajo: no recomendado para stock propio en este momento');
  }

  // Estimar demanda mensual (basado en búsquedas y conversión)
  // Asumiendo que los datos históricos cubren al menos 3 meses
  const estimatedMonthlySearches = metrics.totalSearches / 3;
  const estimatedMonthlyOrders = (estimatedMonthlySearches * metrics.conversionRate) / 100;
  const estimatedMonthlyRevenue = estimatedMonthlyOrders * metrics.avgOrderValue;

  return {
    reference: metrics.reference,
    recommended,
    score: Math.round(score),
    priority,
    reasons,
    warnings,
    estimatedMonthlyDemand: Math.round(estimatedMonthlyOrders),
    estimatedMonthlyRevenue: Math.round(estimatedMonthlyRevenue),
  };
}

/**
 * Evalúa el score de conversión
 */
function evaluateConversion(
  conversionRate: number,
  minRate: number,
  reasons: string[],
  warnings: string[]
): number {
  if (conversionRate >= 50) {
    reasons.push(`Conversión excelente: ${conversionRate.toFixed(1)}%`);
    return 100;
  } else if (conversionRate >= 40) {
    reasons.push(`Conversión muy buena: ${conversionRate.toFixed(1)}%`);
    return 80;
  } else if (conversionRate >= minRate) {
    reasons.push(`Conversión aceptable: ${conversionRate.toFixed(1)}%`);
    return 60;
  } else if (conversionRate >= 20) {
    warnings.push(`Conversión baja: ${conversionRate.toFixed(1)}%`);
    return 30;
  } else if (conversionRate > 0) {
    warnings.push(`Conversión muy baja: ${conversionRate.toFixed(1)}%`);
    return 10;
  } else {
    warnings.push('Sin conversiones registradas');
    return 0;
  }
}

/**
 * Evalúa el score de volumen
 */
function evaluateVolume(
  totalSearches: number,
  minVolume: number,
  reasons: string[],
  warnings: string[]
): number {
  if (totalSearches >= 100) {
    reasons.push(`Volumen alto: ${totalSearches} búsquedas`);
    return 100;
  } else if (totalSearches >= 50) {
    reasons.push(`Volumen bueno: ${totalSearches} búsquedas`);
    return 80;
  } else if (totalSearches >= minVolume) {
    reasons.push(`Volumen aceptable: ${totalSearches} búsquedas`);
    return 60;
  } else if (totalSearches >= 10) {
    warnings.push(`Volumen bajo: ${totalSearches} búsquedas`);
    return 30;
  } else {
    warnings.push(`Volumen muy bajo: ${totalSearches} búsquedas`);
    return 10;
  }
}

/**
 * Evalúa el score de tendencia
 */
function evaluateTrend(
  direction: 'up' | 'down' | 'stable',
  reasons: string[],
  warnings: string[]
): number {
  if (direction === 'up') {
    reasons.push('Tendencia creciente detectada');
    return 100;
  } else if (direction === 'stable') {
    reasons.push('Tendencia estable');
    return 60;
  } else {
    warnings.push('Tendencia decreciente detectada');
    return 20;
  }
}

/**
 * Evalúa el score de revenue (valores en USD)
 */
function evaluateRevenue(
  totalRevenue: number,
  minRevenue: number,
  reasons: string[],
  warnings: string[]
): number {
  const revenueFormatted = totalRevenue >= 1000
    ? `$${(totalRevenue / 1000).toFixed(1)}k`
    : `$${Math.round(totalRevenue)}`;

  if (totalRevenue >= minRevenue * 5) {
    reasons.push(`Revenue alto: ${revenueFormatted} USD`);
    return 100;
  } else if (totalRevenue >= minRevenue * 2) {
    reasons.push(`Revenue bueno: ${revenueFormatted} USD`);
    return 80;
  } else if (totalRevenue >= minRevenue) {
    reasons.push(`Revenue aceptable: ${revenueFormatted} USD`);
    return 60;
  } else if (totalRevenue > 0) {
    warnings.push(`Revenue bajo: ${revenueFormatted} USD`);
    return 30;
  } else {
    warnings.push('Sin revenue registrado');
    return 0;
  }
}

/**
 * Evalúa la base de clientes (no afecta score, solo agrega insights)
 */
function evaluateClientBase(
  uniqueClients: number,
  reasons: string[],
  warnings: string[]
): void {
  if (uniqueClients >= 10) {
    reasons.push(`Base amplia de clientes: ${uniqueClients} clientes interesados`);
  } else if (uniqueClients >= 5) {
    reasons.push(`Base moderada: ${uniqueClients} clientes interesados`);
  } else if (uniqueClients >= 2) {
    warnings.push(`Base limitada: solo ${uniqueClients} clientes interesados`);
  } else if (uniqueClients === 1) {
    warnings.push('Un solo cliente interesado: riesgo de dependencia');
  }
}

/**
 * Genera recomendaciones para múltiples referencias
 */
export function generateBulkRecommendations(
  metricsArray: Array<{
    metrics: ConversionMetrics;
    trendDirection: 'up' | 'down' | 'stable';
  }>,
  criteria?: Partial<RecommendationCriteria>
): StockRecommendation[] {
  return metricsArray.map(({ metrics, trendDirection }) =>
    evaluateStockRecommendation(metrics, trendDirection, criteria)
  );
}

/**
 * Filtra solo las recomendaciones positivas
 */
export function getRecommendedReferences(
  recommendations: StockRecommendation[]
): StockRecommendation[] {
  return recommendations
    .filter((r) => r.recommended)
    .sort((a, b) => b.score - a.score);
}

/**
 * Agrupa recomendaciones por prioridad
 */
export function groupByPriority(recommendations: StockRecommendation[]): {
  high: StockRecommendation[];
  medium: StockRecommendation[];
  low: StockRecommendation[];
} {
  return {
    high: recommendations.filter((r) => r.priority === 'high'),
    medium: recommendations.filter((r) => r.priority === 'medium'),
    low: recommendations.filter((r) => r.priority === 'low'),
  };
}

/**
 * Calcula inversión estimada total (avgUnitCost en USD)
 */
export function calculateEstimatedInvestment(
  recommendations: StockRecommendation[],
  avgUnitCost: number = 15 // USD por unidad (promedio estimado)
): {
  totalMonthlyDemand: number;
  totalMonthlyRevenue: number;
  estimatedInvestment: number;
  estimatedROI: number;
} {
  const totalMonthlyDemand = recommendations.reduce(
    (sum, r) => sum + r.estimatedMonthlyDemand,
    0
  );
  const totalMonthlyRevenue = recommendations.reduce(
    (sum, r) => sum + r.estimatedMonthlyRevenue,
    0
  );
  const estimatedInvestment = totalMonthlyDemand * avgUnitCost;
  const estimatedROI =
    estimatedInvestment > 0 ? (totalMonthlyRevenue / estimatedInvestment) * 100 : 0;

  return {
    totalMonthlyDemand: Math.round(totalMonthlyDemand),
    totalMonthlyRevenue: Math.round(totalMonthlyRevenue),
    estimatedInvestment: Math.round(estimatedInvestment),
    estimatedROI: Math.round(estimatedROI * 100) / 100,
  };
}
