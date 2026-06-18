'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import {
    DocumentTextIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    EyeIcon,
    ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

interface Quote {
    id: number;
    agentId: number;
    clientId?: number;
    items: any[];
    status: string;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
}

interface QuoteStats {
    totalQuotes: number;
    runningQuotes: number;
    hotQuotes: number;
    warmQuotes: number;
    coldQuotes: number;
    closedQuotes: number;
    conversionRate: number;
}

export function QuoteOversight() {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [stats, setStats] = useState<QuoteStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        const fetchQuoteOversight = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/analytics/quotes');

                if (!response.ok) {
                    throw new Error('Failed to fetch quote oversight data');
                }

                const data = await response.json();
                setQuotes(data.data.quotes);
                setStats(data.data.stats);
            } catch (error) {
                console.error('Error fetching quote oversight:', error);
                toast.error('Failed to load quote oversight data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuoteOversight();
    }, []);

    const filteredQuotes = statusFilter === 'all'
        ? quotes
        : quotes.filter(quote => quote.status === statusFilter);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-blue-100 text-blue-800';
            case 'hot':
                return 'bg-red-100 text-red-800';
            case 'warm':
                return 'bg-yellow-100 text-yellow-800';
            case 'cold':
                return 'bg-gray-100 text-gray-800';
            case 'closed':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const handleExportQuote = async (quoteId: number) => {
        try {
            const response = await fetch(`/api/quotes/${quoteId}/export`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quote-${quoteId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('Quote exported successfully');
            } else {
                throw new Error('Failed to export quote');
            }
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export quote');
        }
    };

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
                    No quote oversight data found.
                </p>
            </div>
        );
    }

    const statCards = [
        {
            name: 'Total Quotes',
            value: stats.totalQuotes.toLocaleString(),
            icon: DocumentTextIcon,
            description: 'All quotes',
        },
        {
            name: 'Running',
            value: stats.runningQuotes.toLocaleString(),
            icon: ClockIcon,
            description: 'Active quotes',
        },
        {
            name: 'Hot Quotes',
            value: stats.hotQuotes.toLocaleString(),
            icon: ExclamationTriangleIcon,
            description: 'High priority',
        },
        {
            name: 'Conversion Rate',
            value: `${stats.conversionRate.toFixed(1)}%`,
            icon: CheckCircleIcon,
            description: 'Success rate',
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

            {/* Status Filter */}
            <div className="card">
                <div className="card-body">
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field"
                        >
                            <option value="all">All Statuses</option>
                            <option value="running">Running</option>
                            <option value="hot">Hot</option>
                            <option value="warm">Warm</option>
                            <option value="cold">Cold</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Quotes Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">Running Quotes</h3>
                </div>
                <div className="card-body">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quote ID</TableHead>
                                <TableHead>Agent ID</TableHead>
                                <TableHead>Client ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total Amount</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredQuotes.map((quote) => (
                                <TableRow key={quote.id}>
                                    <TableCell className="font-medium">#{quote.id}</TableCell>
                                    <TableCell>{quote.agentId}</TableCell>
                                    <TableCell>{quote.clientId || 'N/A'}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                                            {quote.status}
                                        </span>
                                    </TableCell>
                                    <TableCell>{quote.items.length}</TableCell>
                                    <TableCell>{formatCurrency(Number(quote.totalAmount))}</TableCell>
                                    <TableCell>{new Date(quote.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleExportQuote(quote.id)}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Export PDF"
                                            >
                                                <ArrowDownTrayIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                className="text-gray-600 hover:text-gray-800"
                                                title="View Details"
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {filteredQuotes.length === 0 && (
                        <div className="text-center py-8">
                            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No quotes found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No quotes match the current filter criteria.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
