'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
    MagnifyingGlassIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ClockIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';

interface SearchStats {
    totalSearches: number;
    searchesToday: number;
    searchesThisWeek: number;
    searchesThisMonth: number;
    popularSearches: PopularSearch[];
    searchTrends: SearchTrend[];
    userActivity: UserActivity[];
}

interface PopularSearch {
    searchTerm: string;
    count: number;
    hasStock: boolean;
    lastSearched: Date;
}

interface SearchTrend {
    date: string;
    searchCount: number;
    userType: 'agent' | 'client' | 'admin';
}

interface UserActivity {
    userId: number;
    username: string;
    searchCount: number;
    lastActivity: Date;
    userType: 'agent' | 'client' | 'admin';
}

export function SearchMonitoring() {
    const [stats, setStats] = useState<SearchStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        const fetchSearchMonitoring = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(
                    `/api/analytics/searches?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch search monitoring data');
                }

                const data = await response.json();
                setStats(data.data);
            } catch (error) {
                console.error('Error fetching search monitoring:', error);
                toast.error('Failed to load search monitoring data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSearchMonitoring();
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

    if (!stats) {
        return (
            <div className="text-center py-12">
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
                <p className="mt-1 text-sm text-gray-500">
                    No search monitoring data found for the selected date range.
                </p>
            </div>
        );
    }

    const statCards = [
        {
            name: 'Total Searches',
            value: stats.totalSearches.toLocaleString(),
            icon: MagnifyingGlassIcon,
            change: '+12%',
            changeType: 'positive' as const,
            description: 'All time',
        },
        {
            name: 'Today',
            value: stats.searchesToday.toLocaleString(),
            icon: ClockIcon,
            change: '+8%',
            changeType: 'positive' as const,
            description: 'From yesterday',
        },
        {
            name: 'This Week',
            value: stats.searchesThisWeek.toLocaleString(),
            icon: ArrowTrendingUpIcon,
            change: '+15%',
            changeType: 'positive' as const,
            description: 'From last week',
        },
        {
            name: 'This Month',
            value: stats.searchesThisMonth.toLocaleString(),
            icon: UserGroupIcon,
            change: '+5%',
            changeType: 'positive' as const,
            description: 'From last month',
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
                                        <dd className="flex items-baseline">
                                            <div className="text-2xl font-semibold text-gray-900">
                                                {stat.value}
                                            </div>
                                            <div className={`ml-2 flex items-baseline text-sm font-semibold ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {stat.changeType === 'positive' ? (
                                                    <ArrowTrendingUpIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                                ) : (
                                                    <ArrowTrendingDownIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                                )}
                                                <span className="sr-only">
                                                    {stat.changeType === 'positive' ? 'Increased' : 'Decreased'} by
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

            {/* Popular Searches and User Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Popular Searches */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">Popular Search Terms</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-4">
                            {stats.popularSearches.map((search, index) => (
                                <div key={search.searchTerm} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-sm font-medium text-gray-900">
                                            {index + 1}. {search.searchTerm}
                                        </span>
                                        <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${search.hasStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {search.hasStock ? 'In Stock' : 'Out of Stock'}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-500">{search.count} searches</span>
                                        <div className="w-16 bg-gray-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{
                                                    width: `${(search.count / Math.max(...stats.popularSearches.map(s => s.count))) * 100}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* User Activity */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="text-lg font-medium text-gray-900">User Activity</h3>
                    </div>
                    <div className="card-body">
                        <div className="space-y-4">
                            {stats.userActivity.map((user) => (
                                <div key={user.userId} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-sm font-medium text-gray-900">{user.username}</span>
                                        <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${user.userType === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            user.userType === 'agent' ? 'bg-blue-100 text-blue-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                            {user.userType}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-500">{user.searchCount} searches</span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(user.lastActivity).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
