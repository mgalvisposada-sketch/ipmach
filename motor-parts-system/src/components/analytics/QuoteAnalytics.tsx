'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface QuoteAnalyticsProps {
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface QuoteStats {
  totalQuotes: number;
  runningQuotes: number;
  hotQuotes: number;
  warmQuotes: number;
  coldQuotes: number;
  closedQuotes: number;
  totalRevenue: number;
  conversionRate: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  color: string;
}

export function QuoteAnalytics({ dateRange }: QuoteAnalyticsProps) {
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuoteAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/analytics/quotes?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch quote analytics');
        }

        const data = await response.json();
        setStats(data.data.stats);
        setStatusBreakdown(data.data.statusBreakdown);
      } catch (error) {
        console.error('Error fetching quote analytics:', error);
        toast.error('Failed to load quote analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuoteAnalytics();
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
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
        <p className="mt-1 text-sm text-gray-500">
          No quote analytics data found for the selected date range.
        </p>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Quotes',
      value: stats.totalQuotes.toLocaleString(),
      icon: DocumentTextIcon,
      change: '+15%',
      changeType: 'positive' as const,
      description: 'From previous period',
    },
    {
      name: 'Active Quotes',
      value: (stats.runningQuotes + stats.hotQuotes + stats.warmQuotes).toLocaleString(),
      icon: CheckCircleIcon,
      change: '+8%',
      changeType: 'positive' as const,
      description: 'Running, Hot, Warm',
    },
    {
      name: 'Conversion Rate',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: ArrowTrendingUpIcon,
      change: '+3.2%',
      changeType: 'positive' as const,
      description: 'Quotes to sales',
    },
    {
      name: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: CurrencyDollarIcon,
      change: '+12.5%',
      changeType: 'positive' as const,
      description: 'From closed quotes',
    },
  ];

  return (
    <div className="space-y-6">
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

      {/* Quote Status Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Overview */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quote Status Breakdown</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {statusBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full ${item.color} mr-3`}></div>
                    <span className="text-sm font-medium text-gray-900">{item.status}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{item.count} quotes</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color.replace('bg-', 'bg-')}`}
                        style={{
                          width: `${(item.count / Math.max(...statusBreakdown.map(s => s.count))) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Running Quotes</span>
                <span className="text-sm font-medium text-blue-600">{stats.runningQuotes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Hot Quotes</span>
                <span className="text-sm font-medium text-red-600">{stats.hotQuotes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Warm Quotes</span>
                <span className="text-sm font-medium text-yellow-600">{stats.warmQuotes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Cold Quotes</span>
                <span className="text-sm font-medium text-gray-600">{stats.coldQuotes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Closed Quotes</span>
                <span className="text-sm font-medium text-green-600">{stats.closedQuotes}</span>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Conversion Rate</span>
                  <span className="text-sm font-medium text-green-600">
                    {stats.conversionRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
