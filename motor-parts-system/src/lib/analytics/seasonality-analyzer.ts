/**
 * Seasonality Analyzer
 * Analiza patrones estacionales y proyecta demanda futura
 */

import { startOfQuarter, getQuarter, getYear, startOfMonth, getMonth, startOfWeek, getWeek } from 'date-fns';
import { detectTrend, DataPoint } from './trend-detector';

export interface PeriodData {
  period: string; // e.g., "Q1 2026", "Jan 2026", "Week 5 2026"
  year: number;
  periodNumber: number; // Quarter (1-4), Month (1-12), or Week (1-53)
  searches: number;
  orders: number;
  revenue: number;
}

export interface SeasonalityAnalysis {
  quarterly: PeriodData[];
  monthly: PeriodData[];
  weekly: PeriodData[];
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    confidence: number;
  };
  seasonalPattern: {
    detected: boolean;
    peakPeriods: string[];
    lowPeriods: string[];
    variationCoefficient: number; // % de variación
  };
  prediction: {
    nextQuarter: {
      expectedSearches: number;
      expectedOrders: number;
      confidence: number;
    };
    recommendation: string;
  };
}

interface SearchData {
  searchTerm: string;
  timestamp: Date;
  userId: number | null;
}

interface OrderData {
  id: number;
  items: any;
  createdAt: Date;
  totalAmount: number;
}

/**
 * Agrupa datos por trimestre
 */
function groupByQuarter(
  searches: SearchData[],
  orders: OrderData[],
  reference: string
): PeriodData[] {
  const quarterMap = new Map<string, PeriodData>();

  // Procesar búsquedas
  searches.forEach((search) => {
    const quarter = getQuarter(search.timestamp);
    const year = getYear(search.timestamp);
    const key = `Q${quarter} ${year}`;

    if (!quarterMap.has(key)) {
      quarterMap.set(key, {
        period: key,
        year,
        periodNumber: quarter,
        searches: 0,
        orders: 0,
        revenue: 0,
      });
    }

    const data = quarterMap.get(key)!;
    data.searches++;
  });

  // Procesar órdenes
  orders.forEach((order) => {
    const quarter = getQuarter(order.createdAt);
    const year = getYear(order.createdAt);
    const key = `Q${quarter} ${year}`;

    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const hasReference = items.some(
      (item: any) =>
        item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()
    );

    if (hasReference) {
      if (!quarterMap.has(key)) {
        quarterMap.set(key, {
          period: key,
          year,
          periodNumber: quarter,
          searches: 0,
          orders: 0,
          revenue: 0,
        });
      }

      const data = quarterMap.get(key)!;
      data.orders++;

      // Sumar revenue de items que coincidan con la referencia
      items.forEach((item: any) => {
        if (item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()) {
          data.revenue += item.totalPrice || 0;
        }
      });
    }
  });

  return Array.from(quarterMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.periodNumber - b.periodNumber;
  });
}

/**
 * Agrupa datos por mes
 */
function groupByMonth(
  searches: SearchData[],
  orders: OrderData[],
  reference: string
): PeriodData[] {
  const monthMap = new Map<string, PeriodData>();
  const monthNames = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];

  // Procesar búsquedas
  searches.forEach((search) => {
    const month = getMonth(search.timestamp) + 1; // 1-12
    const year = getYear(search.timestamp);
    const key = `${monthNames[month - 1]} ${year}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        period: key,
        year,
        periodNumber: month,
        searches: 0,
        orders: 0,
        revenue: 0,
      });
    }

    const data = monthMap.get(key)!;
    data.searches++;
  });

  // Procesar órdenes (similar a quarterly)
  orders.forEach((order) => {
    const month = getMonth(order.createdAt) + 1;
    const year = getYear(order.createdAt);
    const key = `${monthNames[month - 1]} ${year}`;

    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const hasReference = items.some(
      (item: any) =>
        item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()
    );

    if (hasReference) {
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          period: key,
          year,
          periodNumber: month,
          searches: 0,
          orders: 0,
          revenue: 0,
        });
      }

      const data = monthMap.get(key)!;
      data.orders++;

      items.forEach((item: any) => {
        if (item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()) {
          data.revenue += item.totalPrice || 0;
        }
      });
    }
  });

  return Array.from(monthMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.periodNumber - b.periodNumber;
  });
}

/**
 * Agrupa datos por semana
 */
function groupByWeek(
  searches: SearchData[],
  orders: OrderData[],
  reference: string
): PeriodData[] {
  const weekMap = new Map<string, PeriodData>();

  // Procesar búsquedas
  searches.forEach((search) => {
    const week = getWeek(search.timestamp);
    const year = getYear(search.timestamp);
    const key = `Sem ${week} ${year}`;

    if (!weekMap.has(key)) {
      weekMap.set(key, {
        period: key,
        year,
        periodNumber: week,
        searches: 0,
        orders: 0,
        revenue: 0,
      });
    }

    const data = weekMap.get(key)!;
    data.searches++;
  });

  // Procesar órdenes
  orders.forEach((order) => {
    const week = getWeek(order.createdAt);
    const year = getYear(order.createdAt);
    const key = `Sem ${week} ${year}`;

    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const hasReference = items.some(
      (item: any) =>
        item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()
    );

    if (hasReference) {
      if (!weekMap.has(key)) {
        weekMap.set(key, {
          period: key,
          year,
          periodNumber: week,
          searches: 0,
          orders: 0,
          revenue: 0,
        });
      }

      const data = weekMap.get(key)!;
      data.orders++;

      items.forEach((item: any) => {
        if (item.reference?.trim().toUpperCase() === reference.trim().toUpperCase()) {
          data.revenue += item.totalPrice || 0;
        }
      });
    }
  });

  return Array.from(weekMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.periodNumber - b.periodNumber;
  });
}

/**
 * Detecta patrones estacionales analizando la variación entre períodos
 */
function detectSeasonalPattern(periods: PeriodData[]): {
  detected: boolean;
  peakPeriods: string[];
  lowPeriods: string[];
  variationCoefficient: number;
} {
  if (periods.length < 4) {
    return {
      detected: false,
      peakPeriods: [],
      lowPeriods: [],
      variationCoefficient: 0,
    };
  }

  const values = periods.map((p) => p.searches);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );

  const variationCoefficient = mean > 0 ? (stdDev / mean) * 100 : 0;

  // Considerar estacional si la variación es mayor al 20%
  const detected = variationCoefficient > 20;

  // Identificar picos y valles (>1 std dev de la media)
  const peakPeriods = periods
    .filter((p) => p.searches > mean + stdDev * 0.5)
    .map((p) => p.period);

  const lowPeriods = periods
    .filter((p) => p.searches < mean - stdDev * 0.5)
    .map((p) => p.period);

  return {
    detected,
    peakPeriods,
    lowPeriods,
    variationCoefficient: Math.round(variationCoefficient * 100) / 100,
  };
}

/**
 * Genera recomendación basada en el análisis
 */
function generateRecommendation(
  trend: any,
  seasonalPattern: any,
  avgConversionRate: number
): string {
  const recommendations: string[] = [];

  // Análisis de tendencia
  if (trend.direction === 'increasing') {
    const growthRate = Math.abs(trend.slope * 90); // Crecimiento en 90 días
    recommendations.push(
      `Demanda creciente con tendencia de ${growthRate.toFixed(1)}% trimestral.`
    );
    if (avgConversionRate > 40) {
      recommendations.push('Alta prioridad para mantener en stock propio.');
    } else {
      recommendations.push('Considerar para stock propio si la conversión mejora.');
    }
  } else if (trend.direction === 'decreasing') {
    recommendations.push('Demanda decreciente. Monitorear antes de invertir en stock.');
  } else {
    recommendations.push('Demanda estable.');
    if (avgConversionRate > 50) {
      recommendations.push('Excelente candidato para stock propio.');
    }
  }

  // Análisis de estacionalidad
  if (seasonalPattern.detected) {
    recommendations.push(
      `Patrón estacional detectado: picos en ${seasonalPattern.peakPeriods.slice(0, 2).join(', ')}.`
    );
    recommendations.push('Planificar compras anticipadas en períodos de alta demanda.');
  }

  // Recomendación de conversión
  if (avgConversionRate > 50) {
    recommendations.push('Tasa de conversión excelente (>50%).');
  } else if (avgConversionRate > 30) {
    recommendations.push('Tasa de conversión buena (>30%).');
  } else if (avgConversionRate > 0) {
    recommendations.push('Tasa de conversión baja. Evaluar estrategia de pricing.');
  }

  return recommendations.join(' ');
}

/**
 * Analiza estacionalidad completa de una referencia
 */
export function analyzeSeasonality(
  reference: string,
  searches: SearchData[],
  orders: OrderData[]
): SeasonalityAnalysis {
  // Agrupar datos
  const quarterly = groupByQuarter(searches, orders, reference);
  const monthly = groupByMonth(searches, orders, reference);
  const weekly = groupByWeek(searches, orders, reference);

  // Analizar tendencia usando datos trimestrales
  const trendDataPoints: DataPoint[] = quarterly.map((q) => ({
    date: new Date(q.year, (q.periodNumber - 1) * 3, 1), // Inicio del trimestre
    value: q.searches,
  }));

  const trendAnalysis = detectTrend(trendDataPoints);

  // Detectar patrón estacional
  const seasonalPattern = detectSeasonalPattern(quarterly);

  // Calcular conversión promedio
  const totalSearches = quarterly.reduce((sum, q) => sum + q.searches, 0);
  const totalOrders = quarterly.reduce((sum, q) => sum + q.orders, 0);
  const avgConversionRate = totalSearches > 0 ? (totalOrders / totalSearches) * 100 : 0;

  // Predicción para próximo trimestre usando la función de tendencia
  const nextQuarterSearches = trendAnalysis.prediction(90); // 90 días = 1 trimestre
  const nextQuarterOrders =
    avgConversionRate > 0 ? (nextQuarterSearches * avgConversionRate) / 100 : 0;

  // Generar recomendación
  const recommendation = generateRecommendation(
    trendAnalysis,
    seasonalPattern,
    avgConversionRate
  );

  return {
    quarterly,
    monthly,
    weekly,
    trend: {
      direction: trendAnalysis.direction,
      slope: trendAnalysis.slope,
      confidence: trendAnalysis.confidence,
    },
    seasonalPattern,
    prediction: {
      nextQuarter: {
        expectedSearches: Math.round(nextQuarterSearches),
        expectedOrders: Math.round(nextQuarterOrders),
        confidence: trendAnalysis.confidence,
      },
      recommendation,
    },
  };
}
