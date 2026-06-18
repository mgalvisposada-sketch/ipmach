'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    ChartBarIcon,
    ArrowTrendingUpIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    ClockIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface PerformanceMetrics {
    totalRevenue: number;
    totalQuotes: number;
    averageQuoteValue: number;
    searchToQuoteRatio: number;
    averageResponseTime: number;
    topPerformingAgents: AgentPerformance[];
    monthlyTrends: MonthlyTrend[];
}

interface AgentPerformance {
    agentId: number;
    agentName: string;
    totalQuotes: number;
    conversionRate: number;
    averageValue: number;
    searchCount: number;
}

interface MonthlyTrend {
    month: string;
    searches: number;
    quotes: number;
    revenue: number;
}

export function PerformanceMetrics() {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        const fetchPerformanceMetrics = async () => {
            setIsLoading(true);
            try {
                // In a real app, this would call your performance metrics API
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Mock data for demonstration
                const mockMetrics: PerformanceMetrics = {
                    totalRevenue: 125000,
                    totalQuotes: 89,
                    averageQuoteValue: 1404.49,
                    searchToQuoteRatio: 7.1,
                    averageResponseTime: 2.3,
                    topPerformingAgents: [
                        {
                            agentId: 1,
                            agentName: 'Maria Rodriguez',
                            totalQuotes: 25,
                            conversionRate: 85.2,
                            averageValue: 1650.00,
                            searchCount: 45,
                        },
                        {
                            agentId: 2,
                            agentName: 'Carlos Mendez',
                            totalQuotes: 18,
                            conversionRate: 72.0,
                            averageValue: 1420.00,
                            searchCount: 32,
                        },
                        {
                            agentId: 3,
                            agentName: 'Ana Lopez',
                            totalQuotes: 22,
                            conversionRate: 91.7,
                            averageValue: 1890.00,
                            searchCount: 28,
                        },
                    ],
                    monthlyTrends: [
                        { month: 'Jan', searches: 120, quotes: 8, revenue: 12000 },
                        { month: 'Feb', searches: 145, quotes: 12, revenue: 18000 },
                        { month: 'Mar', searches: 180, quotes: 15, revenue: 22500 },
                        { month: 'Apr', searches: 220, quotes: 18, revenue: 27000 },
                        { month: 'May', searches: 280, quotes: 22, revenue: 33000 },
                        { month: 'Jun', searches: 320, quotes: 25, revenue: 37500 },
                    ],
                };

                setMetrics(mockMetrics);
            } catch (error) {
                console.error('Error fetching performance metrics:', error);
                toast.error('Failed to load performance metrics');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPerformanceMetrics();
    }, [dateRange]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, index) => (
                        <div key={index} className="card">
                            <div className="card-body">
                                <div className="animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="text-center py-12">
                <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
                <p className="mt-1 text-sm text-gray-500">
                    No performance metrics data found.
                </p>
            </div>
        );
    }

    const statCards = [
        {
            name: 'Total Revenue',
            value: `$${metrics.totalRevenue.toLocaleString()}`,
            icon: CurrencyDollarIcon,
            description: 'All time revenue',
        },
        {
            name: 'Total Quotes',
            value: metrics.totalQuotes.toLocaleString(),
            icon: ChartBarIcon,
            description: 'Generated quotes',
        },
        {
            name: 'Avg Quote Value',
            value: `$${metrics.averageQuoteValue.toFixed(0)}`,
            icon: ArrowTrendingUpIcon,
            description: 'Per quote',
        },
        {
            name: 'Search to Quote',
            value: `${metrics.searchToQuoteRatio.toFixed(1)}%`,
            icon: CheckCircleIcon,
            description: 'Conversion rate',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="card">
                <div className="card-body">
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700">Date Range:</label>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                            className="input-field"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                            className="input-field"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                                        <dd className="text-2xl font-semibold text-gray-900">
                                            {stat.value}
                                        </dd>
                                        <dd className="text-sm text-gray-500">{stat.description}</dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Top Performing Agents */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Top Performing Agents</h3>
                </div>
                <div className="card-body">
                    <div className="space-y-4">
                        {metrics.topPerformingAgents.map((agent, index) => (
                            <div key={agent.agentId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900">{agent.agentName}</h4>
                                        <p className="text-sm text-gray-500">Agent ID: {agent.agentId}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">{agent.totalQuotes}</p>
                                        <p className="text-xs text-gray-500">Quotes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">{agent.conversionRate.toFixed(1)}%</p>
                                        <p className="text-xs text-gray-500">Conversion</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">${agent.averageValue.toFixed(0)}</p>
                                        <p className="text-xs text-gray-500">Avg Value</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">{agent.searchCount}</p>
                                        <p className="text-xs text-gray-500">Searches</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Monthly Trends */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Monthly Trends</h3>
                </div>
                <div className="card-body">
                    <div className="space-y-4">
                        {metrics.monthlyTrends.map((trend) => (
                            <div key={trend.month} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 text-center">
                                        <h4 className="text-sm font-medium text-gray-900">{trend.month}</h4>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">{trend.searches}</p>
                                        <p className="text-xs text-gray-500">Searches</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">{trend.quotes}</p>
                                        <p className="text-xs text-gray-500">Quotes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">${trend.revenue.toLocaleString()}</p>
                                        <p className="text-xs text-gray-500">Revenue</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900">
                                            {trend.searches > 0 ? ((trend.quotes / trend.searches) * 100).toFixed(1) : 0}%
                                        </p>
                                        <p className="text-xs text-gray-500">Conversion</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
