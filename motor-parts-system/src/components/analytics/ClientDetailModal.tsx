'use client';

import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useApiCall } from '@/lib/api-client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientData {
  clientId: number;
  clientName: string;
  email: string;
  phoneNumber: string | null;
  searchCount: number;
  firstSearch: string;
  lastSearch: string;
  converted: boolean;
  orderDate: string | null;
  orderValue: number | null;
  timeToPurchase: number | null;
  avgSearchFrequency: number;
  orderCount: number;
}

interface SummaryData {
  totalClients: number;
  convertedClients: number;
  conversionRate: number;
  avgTimeToPurchase: number | null;
  avgOrderValue: number;
}

interface InsightsData {
  highInterestClients: string[];
  topRelatedReferences: Array<{ reference: string; count: number }>;
}

interface Props {
  reference: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientDetailModal({ reference, isOpen, onClose }: Props) {
  const apiCall = useApiCall();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'converted' | 'pending'>('all');

  useEffect(() => {
    if (isOpen && reference) {
      fetchClientDetails();
    }
  }, [isOpen, reference]);

  const fetchClientDetails = async () => {
    setIsLoading(true);
    try {
      const response = await apiCall(
        `/api/analytics/references/${encodeURIComponent(reference)}/clients`
      );
      if (response.ok) {
        const result = await response.json();
        setClients(result.data.clients);
        setSummary(result.data.summary);
        setInsights(result.data.insights);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy', { locale: es });
  };

  const filteredClients = clients
    .filter((client) => {
      const matchesSearch =
        client.clientName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        client.email.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'converted' && client.converted) ||
        (statusFilter === 'pending' && !client.converted);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort: converted first, then by search count
      if (a.converted !== b.converted) return a.converted ? -1 : 1;
      return b.searchCount - a.searchCount;
    });

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl">
                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Análisis de Clientes
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
                      {summary && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <UserGroupIcon className="h-5 w-5 text-blue-600" />
                              <p className="text-sm font-medium text-blue-900">
                                Total Clientes
                              </p>
                            </div>
                            <p className="text-2xl font-bold text-blue-900">
                              {summary.totalClients}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              {summary.convertedClients} convirtieron
                            </p>
                          </div>

                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                              <p className="text-sm font-medium text-green-900">
                                Tasa Conversión
                              </p>
                            </div>
                            <p className="text-2xl font-bold text-green-900">
                              {summary.conversionRate.toFixed(1)}%
                            </p>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <ClockIcon className="h-5 w-5 text-purple-600" />
                              <p className="text-sm font-medium text-purple-900">
                                Tiempo Promedio
                              </p>
                            </div>
                            <p className="text-2xl font-bold text-purple-900">
                              {summary.avgTimeToPurchase !== null
                                ? `${summary.avgTimeToPurchase} días`
                                : 'N/A'}
                            </p>
                            <p className="text-xs text-purple-700 mt-1">
                              Hasta primera compra
                            </p>
                          </div>

                          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                            <div className="flex items-center gap-2 mb-2">
                              <CurrencyDollarIcon className="h-5 w-5 text-yellow-600" />
                              <p className="text-sm font-medium text-yellow-900">
                                Valor Promedio
                              </p>
                            </div>
                            <p className="text-xl font-bold text-yellow-900">
                              {formatCurrency(summary.avgOrderValue)}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">Por orden</p>
                          </div>
                        </div>
                      )}

                      {/* Insights Section */}
                      {insights && (insights.highInterestClients.length > 0 || insights.topRelatedReferences.length > 0) && (
                        <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                          <h4 className="text-sm font-semibold text-blue-900 mb-3">
                            Insights Clave
                          </h4>
                          {insights.highInterestClients.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm text-blue-800 font-medium mb-1">
                                Clientes de Alto Interés (múltiples búsquedas, sin conversión):
                              </p>
                              <p className="text-sm text-blue-700">
                                {insights.highInterestClients.join(', ')}
                              </p>
                            </div>
                          )}
                          {insights.topRelatedReferences.length > 0 && (
                            <div>
                              <p className="text-sm text-blue-800 font-medium mb-1">
                                Referencias Relacionadas (también buscadas):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {insights.topRelatedReferences.map((ref) => (
                                  <span
                                    key={ref.reference}
                                    className="px-2 py-1 bg-white text-blue-700 text-xs rounded border border-blue-300"
                                  >
                                    {ref.reference} ({ref.count})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Filters */}
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex-1 min-w-[200px]">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar cliente..."
                              value={searchFilter}
                              onChange={(e) => setSearchFilter(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {(['all', 'converted', 'pending'] as const).map((filter) => (
                            <button
                              key={filter}
                              onClick={() => setStatusFilter(filter)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                statusFilter === filter
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {filter === 'all' && 'Todos'}
                              {filter === 'converted' && 'Convertidos'}
                              {filter === 'pending' && 'Pendientes'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Client Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Cliente
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Búsquedas
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Primera/Última
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Estado
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Valor Orden
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Tiempo Compra
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredClients.map((client) => (
                              <tr key={client.clientId} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {client.clientName}
                                    </p>
                                    <p className="text-xs text-gray-500">{client.email}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {client.searchCount}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs text-gray-600">
                                    <p>{formatDate(client.firstSearch)}</p>
                                    <p className="text-gray-400">
                                      {formatDate(client.lastSearch)}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {client.converted ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircleIcon className="h-3 w-3" />
                                      Convertido
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                      <ClockIcon className="h-3 w-3" />
                                      Pendiente
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-gray-900">
                                    {client.orderValue !== null
                                      ? formatCurrency(client.orderValue)
                                      : '-'}
                                  </p>
                                  {client.orderCount > 1 && (
                                    <p className="text-xs text-gray-500">
                                      {client.orderCount} órdenes
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-gray-900">
                                    {client.timeToPurchase !== null
                                      ? `${client.timeToPurchase} días`
                                      : '-'}
                                  </p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {filteredClients.length === 0 && (
                          <div className="text-center py-8">
                            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm text-gray-600">
                              No se encontraron clientes
                            </p>
                          </div>
                        )}
                      </div>
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
