'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ChartBarIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { useApiCall } from '@/lib/api-client';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PeriodData {
  period: string;
  year: number;
  periodNumber: number;
  searches: number;
  orders: number;
  revenue: number;
}

interface SeasonalityData {
  quarterly: PeriodData[];
  monthly: PeriodData[];
  weekly: PeriodData[];
}

interface TrendData {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  confidence: number;
}

interface SeasonalPattern {
  detected: boolean;
  peakPeriods: string[];
  lowPeriods: string[];
  variationCoefficient: number;
}

interface PredictionData {
  nextQuarter: {
    expectedSearches: number;
    expectedOrders: number;
    confidence: number;
  };
  recommendation: string;
}

interface Props {
  reference: string;
  isOpen: boolean;
  onClose: () => void;
}

type ViewType = 'quarterly' | 'monthly' | 'weekly';

export function SeasonalityAnalysisModal({ reference, isOpen, onClose }: Props) {
  const apiCall = useApiCall();
  const [seasonality, setSeasonality] = useState<SeasonalityData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [seasonalPattern, setSeasonalPattern] = useState<SeasonalPattern | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [context, setContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('quarterly');

  useEffect(() => {
    if (isOpen && reference) {
      fetchSeasonalityData();
    }
  }, [isOpen, reference]);

  const fetchSeasonalityData = async () => {
    setIsLoading(true);
    try {
      const response = await apiCall(
        `/api/analytics/references/${encodeURIComponent(reference)}/seasonality`
      );
      if (response.ok) {
        const result = await response.json();
        setSeasonality(result.data.seasonality);
        setTrend(result.data.trend);
        setSeasonalPattern(result.data.seasonalPattern);
        setPrediction(result.data.prediction);
        setContext(result.data.context);
      }
    } catch (error) {
      console.error('Error fetching seasonality data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'increasing')
      return <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />;
    if (trend.direction === 'decreasing')
      return <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />;
    return <ChartBarIcon className="h-5 w-5 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600';
    if (trend.direction === 'increasing') return 'text-green-600';
    if (trend.direction === 'decreasing') return 'text-red-600';
    return 'text-gray-600';
  };

  const getTrendLabel = () => {
    if (!trend) return 'Sin datos';
    if (trend.direction === 'increasing') return 'Creciente';
    if (trend.direction === 'decreasing') return 'Decreciente';
    return 'Estable';
  };

  const getCurrentData = (): PeriodData[] => {
    if (!seasonality) return [];
    switch (viewType) {
      case 'monthly':
        return seasonality.monthly;
      case 'weekly':
        return seasonality.weekly;
      case 'quarterly':
      default:
        return seasonality.quarterly;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-1">{data.period}</p>
          <p className="text-sm text-blue-600">Búsquedas: {data.searches}</p>
          <p className="text-sm text-green-600">Órdenes: {data.orders}</p>
          {data.orders > 0 && (
            <p className="text-sm text-gray-600">
              Conversión: {((data.orders / data.searches) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Análisis de Estacionalidad y Tendencias
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 mt-1">
                        Referencia: <span className="font-medium">{reference}</span>
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-2 hover:bg-gray-200 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <>
                      {/* Summary Cards */}
                      {trend && prediction && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              {getTrendIcon()}
                              <p className="text-sm font-medium text-gray-700">
                                Tendencia
                              </p>
                            </div>
                            <p className={`text-2xl font-bold ${getTrendColor()}`}>
                              {getTrendLabel()}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Confianza: {trend.confidence}%
                            </p>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <ChartBarIcon className="h-5 w-5 text-purple-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Proyección Próximo Trimestre
                              </p>
                            </div>
                            <p className="text-xl font-bold text-purple-900">
                              {prediction.nextQuarter.expectedSearches} búsquedas
                            </p>
                            <p className="text-xs text-purple-700 mt-1">
                              ~{prediction.nextQuarter.expectedOrders} órdenes esperadas
                            </p>
                          </div>

                          {seasonalPattern && (
                            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                              <div className="flex items-center gap-2 mb-2">
                                <LightBulbIcon className="h-5 w-5 text-yellow-600" />
                                <p className="text-sm font-medium text-gray-700">
                                  Patrón Estacional
                                </p>
                              </div>
                              <p className="text-xl font-bold text-yellow-900">
                                {seasonalPattern.detected ? 'Detectado' : 'No detectado'}
                              </p>
                              {seasonalPattern.detected && (
                                <p className="text-xs text-yellow-700 mt-1">
                                  Variación: {seasonalPattern.variationCoefficient.toFixed(1)}%
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recommendation Box */}
                      {prediction && (
                        <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                          <div className="flex items-start gap-3">
                            <LightBulbIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-semibold text-green-900 mb-2">
                                Recomendación
                              </h4>
                              <p className="text-sm text-green-800 leading-relaxed">
                                {prediction.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Seasonal Pattern Details */}
                      {seasonalPattern && seasonalPattern.detected && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">
                            Detalles del Patrón Estacional
                          </h4>
                          {seasonalPattern.peakPeriods.length > 0 && (
                            <div className="mb-2">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Períodos de pico:</span>{' '}
                                {seasonalPattern.peakPeriods.join(', ')}
                              </p>
                            </div>
                          )}
                          {seasonalPattern.lowPeriods.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Períodos bajos:</span>{' '}
                                {seasonalPattern.lowPeriods.join(', ')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* View Type Selector */}
                      <div className="flex items-center gap-2 mb-4">
                        <p className="text-sm font-medium text-gray-700">Vista:</p>
                        {(['quarterly', 'monthly', 'weekly'] as ViewType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => setViewType(type)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              viewType === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {type === 'quarterly' && 'Trimestral'}
                            {type === 'monthly' && 'Mensual'}
                            {type === 'weekly' && 'Semanal'}
                          </button>
                        ))}
                      </div>

                      {/* Charts */}
                      {seasonality && (
                        <>
                          {/* Line Chart: Searches and Orders Trend */}
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Evolución de Búsquedas y Órdenes
                            </h4>
                            <div style={{ width: '100%', height: '300px' }}>
                              <ResponsiveContainer>
                                <LineChart
                                  data={getCurrentData()}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                  <XAxis
                                    dataKey="period"
                                    stroke="#6B7280"
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                  />
                                  <YAxis stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Legend />
                                  <Line
                                    type="monotone"
                                    dataKey="searches"
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    name="Búsquedas"
                                    dot={{ fill: '#3B82F6', r: 4 }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    name="Órdenes"
                                    dot={{ fill: '#10B981', r: 4 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Bar Chart: Comparison */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Comparación por Período
                            </h4>
                            <div style={{ width: '100%', height: '300px' }}>
                              <ResponsiveContainer>
                                <BarChart
                                  data={getCurrentData()}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                  <XAxis
                                    dataKey="period"
                                    stroke="#6B7280"
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                  />
                                  <YAxis stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Legend />
                                  <Bar
                                    dataKey="searches"
                                    fill="#3B82F6"
                                    name="Búsquedas"
                                    radius={[8, 8, 0, 0]}
                                  />
                                  <Bar
                                    dataKey="orders"
                                    fill="#10B981"
                                    name="Órdenes"
                                    radius={[8, 8, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Context Info */}
                      {context && (
                        <div className="mt-6 text-xs text-gray-500">
                          <p>
                            Datos del período: {new Date(context.periodStart).toLocaleDateString()} -{' '}
                            {new Date(context.periodEnd).toLocaleDateString()}
                          </p>
                          <p>
                            Total: {context.totalSearches} búsquedas, {context.totalOrders}{' '}
                            órdenes ({context.conversionRate}% conversión)
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
