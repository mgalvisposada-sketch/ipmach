'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useApiCall } from '@/lib/api-client';
import {
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  CalendarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { subQuarters, subMonths, subYears, format } from 'date-fns';
import { ReferenceConversionChart } from '@/components/analytics/ReferenceConversionChart';
import { ClientDetailModal } from '@/components/analytics/ClientDetailModal';
import { SeasonalityAnalysisModal } from '@/components/analytics/SeasonalityAnalysisModal';
import { ClearDataModal } from '@/components/analytics/ClearDataModal';

export const dynamic = 'force-dynamic';

interface ReferenceData {
  reference: string;
  totalSearches: number;
  uniqueClients: number;
  totalOrders: number;
  conversionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendSlope: number;
  trendConfidence: number;
  stockRecommended: boolean;
  stockScore: number;
  stockPriority: 'high' | 'medium' | 'low' | 'none';
}

interface PeriodInfo {
  startDate: string;
  endDate: string;
  totalSearches: number;
  totalOrders: number;
  totalRevenue: number;
  avgConversionRate: number;
  totalReferences: number;
  highConversionReferences: number;
}

type SortField = 'searches' | 'conversion' | 'revenue' | 'orders';
type PeriodPreset = 'quarter' | '6months' | 'year' | 'custom';

export default function ReferenceAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const apiCall = useApiCall();

  const [references, setReferences] = useState<ReferenceData[]>([]);
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>('searches');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchFilter, setSearchFilter] = useState('');
  const [minSearches, setMinSearches] = useState(1);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('quarter');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [seasonalityModalOpen, setSeasonalityModalOpen] = useState(false);
  const [clearDataModalOpen, setClearDataModalOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status, router, session]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        sortBy,
        minSearches: minSearches.toString(),
        limit: '100',
      });

      const response = await apiCall(`/api/analytics/references/conversion?${params}`);
      if (response.ok) {
        const result = await response.json();
        setReferences(result.data.references);
        setPeriodInfo(result.data.periodInfo);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRange = (): { start: Date; end: Date } => {
    const end = endDate ? new Date(endDate) : new Date();

    if (periodPreset === 'custom' && startDate) {
      return { start: new Date(startDate), end };
    }

    let start: Date;
    switch (periodPreset) {
      case '6months':
        start = subMonths(end, 6);
        break;
      case 'year':
        start = subYears(end, 1);
        break;
      case 'quarter':
      default:
        start = subQuarters(end, 1);
    }

    return { start, end };
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredReferences = references
    .filter((ref) =>
      ref.reference.toLowerCase().includes(searchFilter.toLowerCase())
    )
    .sort((a, b) => {
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

      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTrendIcon = (direction: string) => {
    if (direction === 'increasing') return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
    if (direction === 'decreasing')
      return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
    return <ChartBarIcon className="h-4 w-4 text-gray-400" />;
  };

  const getPriorityBadge = (priority: string, recommended: boolean) => {
    if (!recommended) return null;

    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    const labels = {
      high: 'Prioridad Alta',
      medium: 'Prioridad Media',
      low: 'Considerar',
    };

    const color = colors[priority as keyof typeof colors] || '';
    const label = labels[priority as keyof typeof labels] || '';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${color}`}>
        {label}
      </span>
    );
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Análisis de Referencias y Conversión
          </h1>
          <p className="text-gray-600">
            Identifica productos candidatos a stock propio basándote en búsquedas y conversión
          </p>
        </div>
        <button
          onClick={() => setClearDataModalOpen(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
          title="Limpiar todos los datos históricos de análisis"
        >
          <TrashIcon className="h-4 w-4" />
          Limpiar Datos
        </button>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <CalendarIcon className="h-5 w-5 text-gray-500" />
          <div className="flex gap-2">
            {(['quarter', '6months', 'year', 'custom'] as PeriodPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setPeriodPreset(preset);
                  if (preset !== 'custom') fetchAnalytics();
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodPreset === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset === 'quarter' && 'Último Trimestre'}
                {preset === '6months' && 'Últimos 6 Meses'}
                {preset === 'year' && 'Último Año'}
                {preset === 'custom' && 'Personalizado'}
              </button>
            ))}
          </div>

          {periodPreset === 'custom' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-500">a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Aplicar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {periodInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Total Referencias</p>
              <MagnifyingGlassIcon className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {periodInfo.totalReferences}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {periodInfo.totalSearches.toLocaleString()} búsquedas
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Conversión Promedio</p>
              <ChartBarIcon className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {periodInfo.avgConversionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {periodInfo.totalOrders} órdenes generadas
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Alta Conversión</p>
              <ArrowTrendingUpIcon className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {periodInfo.highConversionReferences}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Referencias con conversión &gt;50%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">Revenue total (USD)</p>
              <ShoppingCartIcon className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(periodInfo.totalRevenue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Del período seleccionado</p>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="mb-6">
        <ReferenceConversionChart references={references} />
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar referencia..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-500" />
              <label className="text-sm text-gray-700">Mín. búsquedas:</label>
              <select
                value={minSearches}
                onChange={(e) => {
                  setMinSearches(parseInt(e.target.value));
                  fetchAnalytics();
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1+</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
                <option value="20">20+</option>
                <option value="50">50+</option>
              </select>
            </div>

            <p className="text-sm text-gray-600">
              Mostrando {filteredReferences.length} referencias
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('searches')}
                >
                  <div className="flex items-center gap-1">
                    Referencia
                    {sortBy === 'searches' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('searches')}
                >
                  <div className="flex items-center gap-1">
                    Búsquedas
                    {sortBy === 'searches' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Clientes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('orders')}
                >
                  <div className="flex items-center gap-1">
                    Órdenes
                    {sortBy === 'orders' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('conversion')}
                >
                  <div className="flex items-center gap-1">
                    Conversión
                    {sortBy === 'conversion' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center gap-1">
                    Revenue (USD)
                    {sortBy === 'revenue' &&
                      (sortOrder === 'desc' ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Tendencia
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Recomendación
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReferences.map((ref) => (
                <tr key={ref.reference} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {ref.reference}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ref.totalSearches}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedReference(ref.reference);
                        setClientModalOpen(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {ref.uniqueClients} clientes
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ref.totalOrders}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className={`text-sm font-semibold ${
                        ref.conversionRate >= 50
                          ? 'text-green-600'
                          : ref.conversionRate >= 30
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {ref.conversionRate.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(ref.totalRevenue)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setSelectedReference(ref.reference);
                        setSeasonalityModalOpen(true);
                      }}
                      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                      title="Ver análisis de estacionalidad"
                    >
                      {getTrendIcon(ref.trendDirection)}
                      <span className="text-xs text-gray-600">
                        {ref.trendConfidence}%
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPriorityBadge(ref.stockPriority, ref.stockRecommended)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredReferences.length === 0 && (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                No se encontraron referencias con los filtros actuales
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedReference && (
        <>
          <ClientDetailModal
            reference={selectedReference}
            isOpen={clientModalOpen}
            onClose={() => {
              setClientModalOpen(false);
              setSelectedReference(null);
            }}
          />
          <SeasonalityAnalysisModal
            reference={selectedReference}
            isOpen={seasonalityModalOpen}
            onClose={() => {
              setSeasonalityModalOpen(false);
              setSelectedReference(null);
            }}
          />
        </>
      )}

      {/* Clear Data Modal */}
      <ClearDataModal
        isOpen={clearDataModalOpen}
        onClose={() => setClearDataModalOpen(false)}
        onSuccess={() => {
          // Reload page after successful deletion
          window.location.reload();
        }}
      />
    </div>
  );
}
