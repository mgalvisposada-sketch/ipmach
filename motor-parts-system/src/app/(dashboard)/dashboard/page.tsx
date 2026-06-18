'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApiCall } from '@/lib/api-client';
import {
    MagnifyingGlassIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { SearchesByDayChart } from '@/components/dashboard/SearchesByDayChart';
import { ClientConversionCard } from '@/components/dashboard/ClientConversionCard';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const apiCall = useApiCall();
    const [stats, setStats] = useState({
        totalSearches: { value: 0, change: 0, changeType: 'neutral' as 'positive' | 'negative' | 'neutral' },
        totalQuotes: { value: 0, change: 0, changeType: 'neutral' as 'positive' | 'negative' | 'neutral' },
        activeQuotes: { value: 0, change: 0, changeType: 'neutral' as 'positive' | 'negative' | 'neutral' },
        conversionRate: { value: 0, change: 0, changeType: 'neutral' as 'positive' | 'negative' | 'neutral' },
        totalOrders: { value: 0, change: 0, changeType: 'neutral' as 'positive' | 'negative' | 'neutral' },
    });
    const [popularSearches, setPopularSearches] = useState([]);
    const [quoteStatuses, setQuoteStatuses] = useState([]);
    const [analyticsSummary, setAnalyticsSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Redirect to login if not authenticated
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        // Only fetch data if authenticated
        if (status === 'authenticated') {
            const fetchDashboardData = async () => {
                try {
                    // Fetch all dashboard data in parallel using authenticated API calls
                    const isClient = session?.user?.role === 'client';
                    const isAdmin = session?.user?.role === 'admin';
                    const promises: Promise<Response>[] = [
                        apiCall('/api/dashboard/stats'),
                        apiCall('/api/dashboard/popular-searches?days=7&minCount=2&limit=8')
                    ];
                    if (!isClient) promises.push(apiCall('/api/dashboard/quote-status'));
                    if (isAdmin) promises.push(apiCall('/api/analytics/summary'));
                    const [statsResponse, popularResponse, ...rest] = await Promise.all(promises);

                    if (statsResponse.ok) {
                        const statsResult = await statsResponse.json();
                        setStats(statsResult.data);
                    }

                    if (popularResponse.ok) {
                        const popularResult = await popularResponse.json();
                        setPopularSearches(popularResult.data);
                    }

                    if (!isClient && rest[0]?.ok) {
                        const statusResult = await rest[0].json();
                        setQuoteStatuses(statusResult.data);
                    }

                    if (isAdmin && rest[1]?.ok) {
                        const analyticsResult = await rest[1].json();
                        setAnalyticsSummary(analyticsResult.data);
                    }
                } catch (error) {
                    console.error('Error fetching dashboard data:', error);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchDashboardData();
        }
    }, [status, router, apiCall]);

    const allStatCards = [
        {
            name: 'Búsquedas Totales',
            value: stats.totalSearches.value.toLocaleString(),
            icon: MagnifyingGlassIcon,
            change: `${stats.totalSearches.change >= 0 ? '+' : ''}${stats.totalSearches.change.toFixed(1)}%`,
            changeType: stats.totalSearches.changeType,
            description: 'Últimos 30 días',
        },
        {
            name: 'Cotizaciones Totales',
            value: stats.totalQuotes.value.toLocaleString(),
            icon: DocumentTextIcon,
            change: `${stats.totalQuotes.change >= 0 ? '+' : ''}${stats.totalQuotes.change.toFixed(1)}%`,
            changeType: stats.totalQuotes.changeType,
            description: 'Últimos 30 días',
        },
        {
            name: 'Cotizaciones Activas',
            value: stats.activeQuotes.value.toLocaleString(),
            icon: ChartBarIcon,
            change: `${stats.activeQuotes.change >= 0 ? '+' : ''}${stats.activeQuotes.change.toFixed(1)}%`,
            changeType: stats.activeQuotes.changeType,
            description: 'Últimos 7 días',
        },
        {
            name: 'Tasa de Conversión',
            value: `${stats.conversionRate.value.toFixed(1)}%`,
            icon: ArrowTrendingUpIcon,
            change: `${stats.conversionRate.change >= 0 ? '+' : ''}${stats.conversionRate.change.toFixed(1)}%`,
            changeType: stats.conversionRate.changeType,
            description: 'Unidades pedidas por cada 100 consultas',
        },
        {
            name: 'Órdenes',
            value: stats.totalOrders.value.toLocaleString(),
            icon: ClipboardDocumentListIcon,
            change: `${stats.totalOrders.change >= 0 ? '+' : ''}${stats.totalOrders.change.toFixed(1)}%`,
            changeType: stats.totalOrders.changeType,
            description: 'Últimos 30 días',
        },
    ];
    const statCards = allStatCards;

    // Show loading while checking authentication
    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Don't render anything if not authenticated (will redirect)
    if (status === 'unauthenticated') {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    {session?.user?.role === 'admin' ? 'Panel de Administración' : 'Panel'}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    {session?.user?.role === 'admin'
                        ? `Bienvenido, ${session?.user?.name}. Vista general de todas las actividades del sistema.`
                        : `Bienvenido de nuevo, ${session?.user?.name}. Esto es lo que está pasando con tu sistema de repuestos.`
                    }
                </p>
                {session?.user?.role === 'client' && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        <Link
                            href="/client-search"
                            className="inline-flex items-center gap-1.5 text-ipmach-dark font-medium hover:underline"
                        >
                            <MagnifyingGlassIcon className="h-4 w-4" />
                            Buscar repuestos
                        </Link>
                        <span className="text-gray-300">|</span>
                        <Link href="/quotes" className="text-gray-600 hover:text-ipmach-dark hover:underline">
                            Ver cotizaciones
                        </Link>
                        <Link href="/orders" className="text-gray-600 hover:text-ipmach-dark hover:underline">
                            Ver órdenes
                        </Link>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                {statCards.map((stat) => (
                    <div key={stat.name} className="card">
                        <div className="card-body">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <stat.icon className="h-6 w-6 text-gray-400" />
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">
                                            {stat.name}
                                        </dt>
                                        <dd className="flex items-baseline">
                                            <div className="text-2xl font-semibold text-gray-900">
                                                {isLoading ? (
                                                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                                                ) : (
                                                    stat.value
                                                )}
                                            </div>
                                            <div className={`ml-2 flex items-baseline text-sm font-semibold ${stat.changeType === 'positive' ? 'text-green-600' :
                                                stat.changeType === 'negative' ? 'text-red-600' :
                                                    'text-gray-600'
                                                }`}>
                                                {stat.changeType === 'positive' ? (
                                                    <ArrowTrendingUpIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                                ) : stat.changeType === 'negative' ? (
                                                    <ArrowTrendingDownIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                                ) : (
                                                    <div className="h-4 w-4 flex-shrink-0 self-center" />
                                                )}
                                                <span className="sr-only">
                                                    {stat.changeType === 'positive' ? 'Increased' :
                                                        stat.changeType === 'negative' ? 'Decreased' :
                                                            'No change'} by
                                                </span>
                                                {stat.change}
                                            </div>
                                        </dd>
                                        <dd className="text-sm text-gray-500">{stat.description}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Activity - unified timeline: searches, quotes, orders; real users + action links */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">
                            {session?.user?.role === 'admin' ? 'Actividad Reciente (Todos los Usuarios)' : 'Actividad Reciente'}
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {session?.user?.role === 'admin'
                                ? 'Búsquedas, cotizaciones y pedidos para revisar y actuar.'
                                : session?.user?.role === 'client'
                                    ? 'Tus búsquedas recientes y acceso rápido.'
                                    : 'Tus cotizaciones y búsquedas recientes.'}
                        </p>
                    </div>
                    <div className="card-body">
                        <RecentActivity />
                    </div>
                </div>

                {/* Client: chart "Consultas últimos 7 días" | Admin/Agent: Quick Actions */}
                {session?.user?.role === 'client' ? (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-lg font-medium text-gray-900">Tu actividad de consultas</h3>
                            <p className="mt-0.5 text-sm text-gray-500">
                                Consultas por día en los últimos 7 días. Resumen de tu uso de la plataforma.
                            </p>
                        </div>
                        <div className="card-body">
                            <SearchesByDayChart />
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-lg font-medium text-gray-900">Acciones Rápidas</h3>
                        </div>
                        <div className="card-body">
                            <QuickActions userRole={session?.user?.role} />
                        </div>
                    </div>
                )}
            </div>

            {/* Additional Dashboard: 1 col for client (solo Búsquedas Populares), 3 cols for admin/agent */}
            <div className={`grid grid-cols-1 gap-6 ${session?.user?.role === 'client' ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
                {/* Popular Searches - improved for client with "Buscar de nuevo" */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">
                            {session?.user?.role === 'admin' ? 'Búsquedas Populares (Sistema)' : session?.user?.role === 'client' ? 'Referencias que más consultaste' : 'Búsquedas Populares'}
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {session?.user?.role === 'admin'
                                ? 'Referencias más buscadas en los últimos 7 días (mín. 2 búsquedas)'
                                : session?.user?.role === 'client'
                                    ? 'Referencias que más consultaste (últimos 7 días). Haz clic para buscar de nuevo.'
                                    : 'Referencias más buscadas (últimos 7 días)'}
                        </p>
                    </div>
                    <div className="card-body">
                        <div className="space-y-3">
                            {isLoading ? (
                                [...Array(5)].map((_, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                                            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                                        </div>
                                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                ))
                            ) : popularSearches.length > 0 ? (
                                (() => {
                                    const maxCount = Math.max(...popularSearches.map((s: { count: number }) => s.count), 1);
                                    return popularSearches.map((search: { term: string; count: number; hasStock: boolean }, index: number) => {
                                        const barWidth = Math.round((search.count / maxCount) * 100);
                                        const isClient = session?.user?.role === 'client';
                                        const content = (
                                            <>
                                                <span className="flex-shrink-0 w-5 text-xs font-medium text-gray-500 tabular-nums">{index + 1}</span>
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <div className="w-16 sm:w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                                                        <div className="h-full bg-ipmach-yellow rounded-full" style={{ width: `${barWidth}%` }} />
                                                    </div>
                                                    <div className="flex items-center min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                                                        <span className="text-sm font-medium text-gray-900 truncate">{search.term}</span>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${search.hasStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {search.hasStock ? (isClient ? 'Con stock' : 'Con Stock') : isClient ? 'Sin stock' : 'Sin Stock'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-sm text-gray-500 flex-shrink-0 tabular-nums">{search.count} {isClient ? 'consultas' : 'búsquedas'}</span>
                                            </>
                                        );
                                        return isClient ? (
                                            <Link key={index} href={`/client-search?q=${encodeURIComponent(search.term)}`} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                                                {content}
                                                <span className="text-xs text-gray-400 group-hover:text-ipmach-yellow-dark">Buscar →</span>
                                            </Link>
                                        ) : (
                                            <div key={index} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2">
                                                {content}
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No hay referencias con al menos 2 búsquedas en los últimos 7 días</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quote Status Overview - hidden for client */}
                {session?.user?.role !== 'client' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-lg font-medium text-gray-900">
                                {session?.user?.role === 'admin' ? 'Estado de Cotizaciones (Sistema)' : 'Estado de Cotizaciones'}
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="space-y-3">
                                {isLoading ? (
                                    [...Array(5)].map((_, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className="w-3 h-3 bg-gray-200 rounded-full mr-3 animate-pulse"></div>
                                                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                                            </div>
                                            <div className="h-4 w-8 bg-gray-200 rounded animate-pulse"></div>
                                        </div>
                                    ))
                                ) : quoteStatuses.length > 0 ? (
                                    quoteStatuses.map((status: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className={`w-3 h-3 rounded-full ${status.color} mr-3`}></div>
                                                <span className="text-sm font-medium text-gray-900">{status.status}</span>
                                            </div>
                                            <span className="text-sm text-gray-500">{status.count}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500">No hay cotizaciones recientes</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Reference Analytics - Only for admins */}
                {session?.user?.role === 'admin' && (
                    <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                        <div className="card-header border-blue-200">
                            <h3 className="text-lg font-medium text-blue-900">Análisis de Referencias</h3>
                            <p className="mt-0.5 text-sm text-blue-700">Productos que conviene tener en stock propio (último trimestre)</p>
                        </div>
                        <div className="card-body">
                            {isLoading ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                        <div className="flex-1">
                                            <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                                            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                                        </div>
                                        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                        <div className="flex-1">
                                            <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                                            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                                        </div>
                                        <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                        <div>
                                            <p className="text-xs font-medium text-gray-700 mb-0.5">Recomendadas para stock propio</p>
                                            <p className="text-xs text-gray-500 mb-1">Por conversión, volumen y tendencia</p>
                                            <p className="text-2xl font-bold text-blue-900">
                                                {analyticsSummary?.recommendedReferences ?? 0}
                                            </p>
                                            {analyticsSummary && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    de {analyticsSummary.totalReferences} referencias buscadas
                                                </p>
                                            )}
                                        </div>
                                        <ChartBarIcon className="h-8 w-8 text-blue-500" />
                                    </div>
                                    
                                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                                        <div>
                                            <p className="text-xs font-medium text-gray-700 mb-0.5">Conversión por referencia</p>
                                            <p className="text-xs text-gray-500 mb-1">De las referencias buscadas, % que aparecieron en al menos una orden</p>
                                            <p className="text-2xl font-bold text-blue-900">
                                                {analyticsSummary ? `${analyticsSummary.avgConversionRate.toFixed(1)}%` : '0%'}
                                            </p>
                                            {analyticsSummary && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {analyticsSummary.referencesConverted ?? 0} de {analyticsSummary.totalReferences} referencias con orden · {analyticsSummary.totalSearches} búsquedas · {analyticsSummary.totalOrders} órdenes en el período
                                                </p>
                                            )}
                                        </div>
                                        <ArrowTrendingUpIcon className="h-8 w-8 text-green-500" />
                                    </div>

                                    <Link
                                        href="/analytics/references"
                                        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                    >
                                        Ver análisis completo y lista de referencias →
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Client conversion - admin only: consultadores sin convertir, limitar/bloquear consultas */}
                {session?.user?.role === 'admin' && <ClientConversionCard />}

                {/* System Health - hidden for client */}
                {session?.user?.role !== 'client' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="text-lg font-medium text-gray-900">System Health</h3>
                        </div>
                        <div className="card-body">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-900">Database</span>
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Online</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-900">Costex</span>
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Online</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-900">API Response</span>
                                    <span className="text-sm text-gray-500">~120ms</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-900">Uptime</span>
                                    <span className="text-sm text-gray-500">99.9%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
