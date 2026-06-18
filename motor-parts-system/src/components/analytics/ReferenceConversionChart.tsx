'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ReferenceData {
  reference: string;
  totalSearches: number;
  uniqueClients: number;
  totalOrders: number;
  conversionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  stockRecommended: boolean;
  stockPriority: 'high' | 'medium' | 'low' | 'none';
}

interface Props {
  references: ReferenceData[];
}

type ChartType = 'bar' | 'revenue';

export function ReferenceConversionChart({ references }: Props) {
  const [chartType, setChartType] = useState<ChartType>('bar');

  // Prepare data for bar chart (top 15 by revenue)
  const topByRevenue = [...references]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 15)
    .map((ref) => ({
      name: ref.reference.length > 15 ? ref.reference.substring(0, 15) + '...' : ref.reference,
      fullName: ref.reference,
      revenue: Math.round(ref.totalRevenue),
      searches: ref.totalSearches,
      conversion: ref.conversionRate,
      recommended: ref.stockRecommended,
    }));

  // Prepare data for conversion bar chart
  const topByConversion = [...references]
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 15)
    .map((ref) => ({
      name: ref.reference.length > 15 ? ref.reference.substring(0, 15) + '...' : ref.reference,
      fullName: ref.reference,
      conversion: ref.conversionRate,
      searches: ref.totalSearches,
      orders: ref.totalOrders,
      recommended: ref.stockRecommended,
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-1">
            {data.fullName || data.name}
          </p>
          {chartType === 'bar' && (
            <>
              <p className="text-sm text-gray-600">Revenue: {formatCurrency(data.revenue)}</p>
              <p className="text-sm text-gray-600">Búsquedas: {data.searches}</p>
              <p className="text-sm text-gray-600">
                Conversión: {data.conversion.toFixed(1)}%
              </p>
            </>
          )}
          {chartType === 'revenue' && (
            <>
              <p className="text-sm text-gray-600">
                Conversión: {data.conversion.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">Búsquedas: {data.searches}</p>
              <p className="text-sm text-gray-600">Órdenes: {data.orders}</p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Chart Type Selector */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Visualización de Análisis
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType('bar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Top Revenue
          </button>
          <button
            onClick={() => setChartType('revenue')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              chartType === 'revenue'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Top Conversión
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: '400px' }}>
        {chartType === 'bar' && topByRevenue.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topByRevenue}
              margin={{ top: 20, right: 30, left: 80, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fill: '#6B7280' }}
                tickFormatter={formatCurrency}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]}>
                {topByRevenue.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.recommended ? '#3B82F6' : '#9CA3AF'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {chartType === 'bar' && topByRevenue.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No hay datos de revenue en el período.
          </div>
        )}

        {chartType === 'revenue' && topByConversion.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topByConversion}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                stroke="#6B7280"
                tick={{ fill: '#6B7280', fontSize: 12 }}
              />
              <YAxis
                stroke="#6B7280"
                tick={{ fill: '#6B7280' }}
                label={{
                  value: 'Conversión (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#6B7280' },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="conversion" name="Conversión" radius={[8, 8, 0, 0]}>
                {topByConversion.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.conversion >= 50
                        ? '#10B981'
                        : entry.conversion >= 30
                        ? '#F59E0B'
                        : '#6B7280'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {chartType === 'revenue' && topByConversion.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No hay datos de conversión en el período.
          </div>
        )}
      </div>

      {/* Info Text */}
      <div className="mt-4 text-sm text-gray-600">
        {chartType === 'bar' &&
          'Las 15 referencias con mayor revenue generado en el período seleccionado.'}
        {chartType === 'revenue' &&
          'Las 15 referencias con mayor tasa de conversión en el período seleccionado.'}
      </div>
    </div>
  );
}
