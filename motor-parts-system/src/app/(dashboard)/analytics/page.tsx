'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
    MagnifyingGlassIcon,
    DocumentTextIcon,
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { SearchAnalytics } from '@/components/analytics/SearchAnalytics';
import { QuoteAnalytics } from '@/components/analytics/QuoteAnalytics';

export default function AnalyticsPage() {
    const { data: session } = useSession();
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        endDate: new Date().toISOString().split('T')[0], // today
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate loading analytics data
        const loadAnalytics = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setIsLoading(false);
            } catch (error) {
                console.error('Error loading analytics:', error);
                toast.error('Failed to load analytics data');
                setIsLoading(false);
            }
        };

        loadAnalytics();
    }, [dateRange]);

    const handleDateRangeChange = (newDateRange: { startDate: string; endDate: string }) => {
        setDateRange(newDateRange);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Monitor search patterns, quote performance, and system usage.
                </p>
            </div>

            {/* Date Range Selector */}
            <div className="card">
                <div className="card-header">
                    <h2 className="text-lg font-medium text-gray-900">Date Range</h2>
                </div>
                <div className="card-body">
                    <div className="flex items-center space-x-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                                Start Date
                            </label>
                            <input
                                type="date"
                                id="startDate"
                                value={dateRange.startDate}
                                onChange={(e) => handleDateRangeChange({ ...dateRange, startDate: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                                End Date
                            </label>
                            <input
                                type="date"
                                id="endDate"
                                value={dateRange.endDate}
                                onChange={(e) => handleDateRangeChange({ ...dateRange, endDate: e.target.value })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    handleDateRangeChange({
                                        startDate: lastWeek.toISOString().split('T')[0],
                                        endDate: today.toISOString().split('T')[0],
                                    });
                                }}
                                className="btn-secondary"
                            >
                                Last 7 Days
                            </button>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    const today = new Date();
                                    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                                    handleDateRangeChange({
                                        startDate: lastMonth.toISOString().split('T')[0],
                                        endDate: today.toISOString().split('T')[0],
                                    });
                                }}
                                className="btn-secondary"
                            >
                                Last 30 Days
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analytics Components */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Search Analytics */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-lg font-medium text-gray-900">Search Analytics</h2>
                    </div>
                    <div className="card-body">
                        <SearchAnalytics dateRange={dateRange} />
                    </div>
                </div>

                {/* Quote Analytics */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="text-lg font-medium text-gray-900">Quote Analytics</h2>
                    </div>
                    <div className="card-body">
                        <QuoteAnalytics dateRange={dateRange} />
                    </div>
                </div>
            </div>

            {/* Additional Analytics Sections */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Popular Searches */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">Popular Searches</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-3">
                            {[
                                { term: 'ABC123', count: 45, hasStock: true },
                                { term: 'XYZ789', count: 32, hasStock: false },
                                { term: 'DEF456', count: 28, hasStock: true },
                                { term: 'GHI789', count: 22, hasStock: true },
                                { term: 'JKL012', count: 18, hasStock: false },
                            ].map((search, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-sm font-medium text-gray-900">{search.term}</span>
                                        <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${search.hasStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {search.hasStock ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                    <span className="text-sm text-gray-500">{search.count} searches</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quote Status Distribution */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">Quote Status</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-3">
                            {[
                                { status: 'Running', count: 12, color: 'bg-blue-500' },
                                { status: 'Hot', count: 8, color: 'bg-red-500' },
                                { status: 'Warm', count: 15, color: 'bg-yellow-500' },
                                { status: 'Cold', count: 6, color: 'bg-gray-500' },
                                { status: 'Closed', count: 48, color: 'bg-green-500' },
                            ].map((item, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className={`w-3 h-3 rounded-full ${item.color} mr-3`}></div>
                                        <span className="text-sm font-medium text-gray-900">{item.status}</span>
                                    </div>
                                    <span className="text-sm text-gray-500">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* System Performance */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">System Performance</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-900">Avg Search Time</span>
                                <span className="text-sm text-gray-500">~120ms</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-900">Success Rate</span>
                                <span className="text-sm text-green-600">99.2%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-900">Active Users</span>
                                <span className="text-sm text-gray-500">23</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-900">Uptime</span>
                                <span className="text-sm text-green-600">99.9%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
