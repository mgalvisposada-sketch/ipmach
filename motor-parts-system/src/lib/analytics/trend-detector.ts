/**
 * Trend Detector
 * Detecta tendencias en series temporales usando regresión lineal simple
 */

export interface DataPoint {
  date: Date;
  value: number;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number; // Pendiente de la regresión lineal
  confidence: number; // R² score (0-100%)
  yIntercept: number; // Intercepto Y
  prediction: (daysAhead: number) => number; // Función para predecir valores futuros
}

/**
 * Convierte fechas a números (días desde el primer punto)
 */
function dateToNumericDays(dates: Date[]): number[] {
  if (dates.length === 0) return [];

  const firstDate = dates[0].getTime();
  return dates.map((date) => {
    const diffMs = date.getTime() - firstDate;
    return diffMs / (1000 * 60 * 60 * 24); // Convertir a días
  });
}

/**
 * Calcula la media de un array de números
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calcula regresión lineal usando el método de mínimos cuadrados
 * y = mx + b
 */
function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  if (n === 0 || n !== y.length) {
    return { slope: 0, intercept: 0 };
  }

  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += (x[i] - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  return { slope, intercept };
}

/**
 * Calcula el coeficiente de determinación R²
 */
function calculateRSquared(x: number[], y: number[], slope: number, intercept: number): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanY = mean(y);

  let ssRes = 0; // Sum of squares of residuals
  let ssTot = 0; // Total sum of squares

  for (let i = 0; i < n; i++) {
    const predicted = slope * x[i] + intercept;
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }

  if (ssTot === 0) return 0;

  const rSquared = 1 - ssRes / ssTot;
  return Math.max(0, Math.min(1, rSquared)); // Clamp entre 0 y 1
}

/**
 * Detecta la tendencia en una serie temporal
 */
export function detectTrend(dataPoints: DataPoint[]): TrendAnalysis {
  if (dataPoints.length < 2) {
    return {
      direction: 'stable',
      slope: 0,
      confidence: 0,
      yIntercept: 0,
      prediction: () => 0,
    };
  }

  // Ordenar por fecha
  const sorted = [...dataPoints].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Convertir fechas a días numéricos
  const x = dateToNumericDays(sorted.map((p) => p.date));
  const y = sorted.map((p) => p.value);

  // Calcular regresión lineal
  const { slope, intercept } = linearRegression(x, y);

  // Calcular R²
  const rSquared = calculateRSquared(x, y, slope, intercept);
  const confidence = Math.round(rSquared * 100);

  // Determinar dirección basada en la pendiente
  // Umbral: cambio de más de 0.1 unidades por día se considera tendencia
  const slopeThreshold = 0.1;
  let direction: 'increasing' | 'decreasing' | 'stable';

  if (slope > slopeThreshold) {
    direction = 'increasing';
  } else if (slope < -slopeThreshold) {
    direction = 'decreasing';
  } else {
    direction = 'stable';
  }

  // Función de predicción
  const firstDate = sorted[0].date;
  const prediction = (daysAhead: number): number => {
    const lastDay = x[x.length - 1];
    const futureDay = lastDay + daysAhead;
    const predicted = slope * futureDay + intercept;
    return Math.max(0, Math.round(predicted * 100) / 100); // No valores negativos
  };

  return {
    direction,
    slope: Math.round(slope * 10000) / 10000, // 4 decimales
    confidence,
    yIntercept: Math.round(intercept * 100) / 100,
    prediction,
  };
}

/**
 * Detecta tendencia comparando dos períodos
 */
export function comparePeriods(
  currentPeriod: DataPoint[],
  previousPeriod: DataPoint[]
): {
  currentAvg: number;
  previousAvg: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'stable';
} {
  const currentAvg = mean(currentPeriod.map((p) => p.value));
  const previousAvg = mean(previousPeriod.map((p) => p.value));

  const percentageChange =
    previousAvg !== 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

  let direction: 'up' | 'down' | 'stable';
  if (percentageChange > 5) {
    direction = 'up';
  } else if (percentageChange < -5) {
    direction = 'down';
  } else {
    direction = 'stable';
  }

  return {
    currentAvg: Math.round(currentAvg * 100) / 100,
    previousAvg: Math.round(previousAvg * 100) / 100,
    percentageChange: Math.round(percentageChange * 100) / 100,
    direction,
  };
}

/**
 * Calcula la volatilidad (desviación estándar) de una serie
 */
export function calculateVolatility(dataPoints: DataPoint[]): number {
  if (dataPoints.length < 2) return 0;

  const values = dataPoints.map((p) => p.value);
  const avg = mean(values);

  const squaredDiffs = values.map((val) => (val - avg) ** 2);
  const variance = mean(squaredDiffs);
  const stdDev = Math.sqrt(variance);

  return Math.round(stdDev * 100) / 100;
}
