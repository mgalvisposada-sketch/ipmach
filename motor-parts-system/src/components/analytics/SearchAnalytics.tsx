'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface SearchAnalyticsProps {
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface SearchStats {
  totalSearches: number;
  searchesWithStock: number;
  searchesWithoutStock: number;
  stockAvailabilityRate: number;
}

interface PopularSearch {
  searchTerm: string;
  count: number;
}

export function SearchAnalytics({ dateRange }: SearchAnalyticsProps) {
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSearchAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/analytics/searches?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch search analytics');
        }

        const data = await response.json();
        setStats(data.data.stats);
        setPopularSearches(data.data.popularSearches);
      } catch (error) {
        console.error('Error fetching search analytics:', error);
        toast.error('Failed to load search analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchAnalytics();
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
          No search analytics data found for the selected date range.
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
      description: 'From previous period',
    },
    {
      name: 'In Stock',
      value: stats.searchesWithStock.toLocaleString(),
      icon: CheckCircleIcon,
      change: '+8%',
      changeType: 'positive' as const,
      description: 'Parts available',
    },
    {
      name: 'Out of Stock',
      value: stats.searchesWithoutStock.toLocaleString(),
      icon: XCircleIcon,
      change: '-5%',
      changeType: 'negative' as const,
      description: 'Parts unavailable',
    },
    {
      name: 'Availability Rate',
      value: `${stats.stockAvailabilityRate.toFixed(1)}%`,
      icon: ArrowTrendingUpIcon,
      change: '+2.1%',
      changeType: 'positive' as const,
      description: 'Stock success rate',
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

      {/* Popular Searches */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Popular Search Terms</h3>
        </div>
        <div className="card-body">
          {popularSearches.length > 0 ? (
            <div className="space-y-4">
              {popularSearches.map((search, index) => (
                <div key={search.searchTerm} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {index + 1}. {search.searchTerm}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{search.count} searches</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(search.count / Math.max(...popularSearches.map(s => s.count))) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No search data</h3>
              <p className="mt-1 text-sm text-gray-500">
                No popular search terms found for the selected period.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
