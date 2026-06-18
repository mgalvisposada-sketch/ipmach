'use client';

import { useState, useEffect } from 'react';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface StatCardProps {
    name: string;
    value: string | number;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    isLoading?: boolean;
}

export function DashboardStats() {
    const [stats, setStats] = useState({
        totalSearches: 0,
        totalQuotes: 0,
        activeQuotes: 0,
        conversionRate: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setStats({
                    totalSearches: 1247,
                    totalQuotes: 89,
                    activeQuotes: 23,
                    conversionRate: 7.1,
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    return null; // This component is now integrated directly into the dashboard page
}

export function StatCard({
    name,
    value,
    change,
    changeType,
    description,
    icon: Icon,
    isLoading = false
}: StatCardProps) {
    return (
        <div className="card">
            <div className="card-body">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <Icon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                                {name}
                            </dt>
                            <dd className="flex items-baseline">
                                <div className="text-2xl font-semibold text-gray-900">
                                    {isLoading ? (
                                        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                                    ) : (
                                        value
                                    )}
                                </div>
                                <div className={`ml-2 flex items-baseline text-sm font-semibold ${changeType === 'positive' ? 'text-green-600' :
                                    changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                                    }`}>
                                    {changeType === 'positive' ? (
                                        <ArrowTrendingUpIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                    ) : changeType === 'negative' ? (
                                        <ArrowTrendingDownIcon className="h-4 w-4 flex-shrink-0 self-center" />
                                    ) : null}
                                    <span className="sr-only">
                                        {changeType === 'positive' ? 'Increased' :
                                            changeType === 'negative' ? 'Decreased' : 'No change'} by
                                    </span>
                                    {change}
                                </div>
                            </dd>
                            <dd className="text-sm text-gray-500">{description}</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}
