'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { formatCurrency, roundMoney2 } from '@/lib/utils';
import { useQuote } from '@/contexts/QuoteContext';
import {
    EyeIcon,
    DocumentArrowDownIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CalendarIcon,
    UserIcon,
    BuildingOfficeIcon,
    XMarkIcon,
    DocumentTextIcon,
    PencilSquareIcon,
} from '@heroicons/react/24/outline';
import {
    PAYMENT_TRANSFER_DETAILS,
    ZELLE_EMAIL,
    DISPATCH_TYPE_PICKUP,
    DISPATCH_TYPE_INTERNATIONAL_CARRIER,
    PAYMENT_METHOD_CREDIT_LINE,
    PAYMENT_METHOD_TRANSFER,
    PAYMENT_METHOD_ZELLE,
    PAYMENT_METHOD_STRIPE,
    PICKUP_ENTITY_PERSON,
    PICKUP_ENTITY_COMPANY,
    isValidPickupEntity,
    ORDER_PAYMENT_PROOF_EMAIL,
} from '@/lib/order-details-constants';
import { StripeFeeNotice } from '@/components/payments/StripeFeeNotice';
import { InternationalCarrierShippingNotice } from '@/components/orders/InternationalCarrierShippingNotice';
import { PaymentProofNotice } from '@/components/orders/PaymentProofNotice';
import {
    computeInternationalCarrierSurchargeUsd,
    computeTotalOrderWeightLbs,
} from '@/lib/international-carrier-surcharge';

interface Quote {
    id: number;
    agentId: number;
    clientId?: number;
    clientName?: string;
    clientType?: number;
    items: any[];
    status: string;
    totalAmount: number;
    createdAt: string;
    updatedAt: string;
    discountPercent?: number;
    observations?: string;
    // cancellationReason?: string; // Temporarily commented out
    agent?: {
        id: number;
        username: string;
        email: string;
        role: string;
    };
}

interface QuoteFilters {
    status: string;
    agentId: string;
    clientId: string;
    dateFrom: string;
    dateTo: string;
}

export default function QuotesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadQuote } = useQuote();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filters, setFilters] = useState<QuoteFilters>({
        status: '',
        agentId: '',
        clientId: '',
        dateFrom: '',
        dateTo: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [printReference, setPrintReference] = useState<boolean>(true);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        const q = searchParams?.get('q')?.trim() ?? '';
        if (q) {
            setSearchTerm(q);
        }
    }, [searchParams]);

    const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

    const fetchQuotes = useCallback(async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();

            if (filters.status) queryParams.append('status', filters.status);
            if (filters.agentId) queryParams.append('agentId', filters.agentId);
            if (filters.clientId) queryParams.append('clientId', filters.clientId);
            if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

            // Pagination params (page-based)
            queryParams.append('page', String(page));
            queryParams.append('pageSize', String(pageSize));

            const response = await fetch(`/api/quotes?${queryParams.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch quotes');
            }

            setQuotes(data.data || []);
            if (data.pagination) {
                setTotal(data.pagination.total || 0);
                // Keep local pageSize in sync with backend (in case defaults change)
                if (data.pagination.pageSize) {
                    setPageSize(data.pagination.pageSize);
                }
            } else {
                setTotal((data.data || []).length || 0);
            }
        } catch (error: any) {
            console.error('Error fetching quotes:', error);
            toast.error('Error al cargar las cotizaciones');
        } finally {
            setLoading(false);
        }
    }, [filters, page, pageSize]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchQuotes();
        }
    }, [status, fetchQuotes]);

    // When filters change, reset to first page
    useEffect(() => {
        setPage(1);
    }, [filters.status, filters.agentId, filters.clientId, filters.dateFrom, filters.dateTo]);

    const getDiscountPercent = (quote: Quote) => {
        const d = Number(quote.discountPercent || 0);
        return Number.isFinite(d) ? Math.max(0, Math.min(100, d)) : 0;
    };
    const calcTotalFromQuote = (quote: Quote) => {
        const subtotal = calcQuoteTotal(quote);
        const discountPercent = getDiscountPercent(quote);
        const discountAmount = subtotal * (discountPercent / 100);
        const total = subtotal - discountAmount;
        return { subtotal, discountPercent, discountAmount, total };
    };

    const handleViewDetails = (quote: Quote) => {
        setSelectedQuote(quote);
        setShowDetails(true);
    };

    // Load quote into Search flow to edit (delete/add refs)
    const handleEditInSearch = (quote: Quote) => {
        // Map API quote shape to QuoteContext expected structure (lenient mapping handled in loadQuote as well)
        loadQuote({
            id: String(quote.id),
            items: (quote.items || []).map((it: any) => ({
                id: it.id || `${it.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                reference: it.reference,
                stockQty: typeof it.stockQty === 'number' ? it.stockQty : 0,
                basePriceCOP: typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0),
                clientPriceCOP: typeof it.clientPriceCOP === 'number' ? it.clientPriceCOP : undefined,
                hasStock: typeof it.hasStock === 'boolean' ? it.hasStock : true,
                location: it.location,
                description: it.description,
                quantity: typeof it.quantity === 'number' ? it.quantity : 1,
                unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0),
                totalPrice: typeof it.totalPrice === 'number' ? it.totalPrice : ((typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0)) * (typeof it.quantity === 'number' ? it.quantity : 1)),
                source: it.source,
                sourceName: it.sourceName,
            })),
            clientId: quote.clientId,
            clientName: quote.clientName,
            clientType: quote.clientType,
            agentId: quote.agentId,
        });

        // Navigate to search page for editing
        router.push('/search');
        toast.success('Cotización cargada para edición');
    };

    const handleExportPDF = async (quote: Quote) => {
        try {
            toast.loading('Generando PDF...', { id: 'pdf-export' });

            const response = await fetch(`/api/quotes/${quote.id}/export?printReference=${printReference ? '1' : '0'}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cotizacion-${quote.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('PDF generado exitosamente', { id: 'pdf-export' });
        } catch (error: any) {
            console.error('Error exporting PDF:', error);
            toast.error('Error al generar el PDF', { id: 'pdf-export' });
        }
    };

    // Safely calculate quote total from items when API total is missing/invalid
    const calcQuoteTotal = (quote: Quote) => {
        try {
            const apiTotal = Number(quote.totalAmount);
            if (Number.isFinite(apiTotal) && apiTotal >= 0) return apiTotal;
        } catch (_) { }
        try {
            const sum = (quote.items || []).reduce((acc: number, it: any) => {
                const quantity = Number(typeof it.quantity === 'number' ? it.quantity : 1);
                const unit = Number(typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0));
                const line = roundMoney2(
                    Number(typeof it.totalPrice === 'number' ? it.totalPrice : unit * quantity)
                );
                return acc + (Number.isFinite(line) ? line : 0);
            }, 0);
            return roundMoney2(sum);
        } catch (_) {
            return 0;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'bg-blue-100 text-blue-800';
            case 'closed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'running': return 'En Proceso';
            case 'closed': return 'Cerrado';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const filteredQuotes = quotes.filter(quote => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            quote.id.toString().includes(searchLower) ||
            quote.clientName?.toLowerCase().includes(searchLower) ||
            quote.items.some(item =>
                item.reference?.toLowerCase().includes(searchLower) ||
                item.description?.toLowerCase().includes(searchLower) ||
                item.brand?.toLowerCase().includes(searchLower)
            )
        );
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
                    <p className="mt-1 text-sm text-gray-500">Gestiona y visualiza todas las cotizaciones.</p>
                </div>
                <div className="card">
                    <div className="card-body text-center py-12">
                        <div className="spinner mx-auto h-8 w-8"></div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Cargando cotizaciones...</h3>
                    </div>
                </div>
            </div>
        );
    }

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
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
                <p className="mt-1 text-sm text-gray-500">Gestiona y visualiza todas las cotizaciones.</p>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="card-header">
                    <h2 className="text-lg font-medium text-gray-900">Filtros</h2>
                </div>
                <div className="card-body">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estado
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="input-field"
                            >
                                <option value="">Todos</option>
                                <option value="running">En Proceso</option>
                                <option value="hot">Caliente</option>
                                <option value="warm">Tibio</option>
                                <option value="cold">Frío</option>
                                <option value="closed">Cerrado</option>
                                <option value="cancelled">Cancelado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha Desde
                            </label>
                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha Hasta
                            </label>
                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Buscar
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field pl-10"
                                    placeholder="ID, cliente, referencia..."
                                />
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quotes List */}
            <div className="card">
                <div className="card-header">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">
                            Cotizaciones ({total || filteredQuotes.length})
                        </h2>
                        <div className="flex items-center gap-4">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={printReference}
                                    onChange={(e) => setPrintReference(e.target.checked)}
                                />
                                <span>Imprimir Referencia</span>
                            </label>
                            <button
                                onClick={fetchQuotes}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <FunnelIcon className="h-4 w-4" />
                                <span>Actualizar</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {filteredQuotes.length === 0 ? (
                        <div className="text-center py-8">
                            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cotizaciones</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No se encontraron cotizaciones con los filtros aplicados.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {filteredQuotes.map((quote) => (
                                    <div key={quote.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3">
                                                    <h3 className="text-lg font-medium text-gray-900">
                                                        Cotización #{quote.id}
                                                    </h3>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                                                        {getStatusText(quote.status)}
                                                    </span>
                                                </div>

                                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-gray-600">
                                                    <div className="flex items-center space-x-2">
                                                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                                                        <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <UserIcon className="h-4 w-4 text-gray-400" />
                                                        <span>Agente: {quote.agent?.username || `ID: ${quote.agentId}`}</span>
                                                    </div>
                                                    {quote.clientName && (
                                                        <div className="flex items-center space-x-2">
                                                            <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                                                            <span>{quote.clientName}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center space-x-2">
                                                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                                                        <span>{quote.items.length} ítems</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 ml-4">
                                                <div className="text-right">
                                                    <div className="text-lg font-semibold text-gray-900">
                                                        {formatCurrency(calcQuoteTotal(quote), 'USD')}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        <span>Desc: {getDiscountPercent(quote)}% ({formatCurrency(calcTotalFromQuote(quote).discountAmount, 'USD')})</span>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleViewDetails(quote)}
                                                        className="btn-secondary flex items-center space-x-1"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                        <span>Ver</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleExportPDF(quote)}
                                                        className="btn-primary flex items-center space-x-1"
                                                    >
                                                        <DocumentArrowDownIcon className="h-4 w-4" />
                                                        <span>PDF</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination controls */}
                            <div className="mt-6 flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    {total > 0 && (
                                        <span>
                                            Mostrando{' '}
                                            <span className="font-medium">
                                                {Math.min((page - 1) * pageSize + 1, total)}
                                            </span>{' '}
                                            -{' '}
                                            <span className="font-medium">
                                                {Math.min(page * pageSize, total)}
                                            </span>{' '}
                                            de{' '}
                                            <span className="font-medium">{total}</span> cotizaciones
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="flex items-center space-x-2 text-sm text-gray-700">
                                        <span>Por página:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                const newSize = Number(e.target.value);
                                                setPageSize(newSize);
                                                setPage(1);
                                            }}
                                            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={page <= 1}
                                            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Anterior
                                        </button>
                                        <span className="text-sm text-gray-700">
                                            Página <span className="font-medium">{page}</span> de{' '}
                                            <span className="font-medium">{totalPages}</span>
                                        </span>
                                        <button
                                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={page >= totalPages}
                                            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Quote Details Modal */}
            {showDetails && selectedQuote && (
                <QuoteDetailsModal
                    quote={selectedQuote}
                    onClose={() => setShowDetails(false)}
                    onExportPDF={() => handleExportPDF(selectedQuote)}
                    onQuoteUpdated={fetchQuotes}
                />
            )}
        </div>
    );
}

// Quote Details Modal Component
function QuoteDetailsModal({ quote, onClose, onExportPDF, onQuoteUpdated }: {
    quote: Quote;
    onClose: () => void;
    onExportPDF: () => void;
    onQuoteUpdated: () => void;
}) {
    const router = useRouter();
    const { loadQuote } = useQuote();
    const { data: session } = useSession();
    const [discountPercent, setDiscountPercent] = useState<number>(Number(quote.discountPercent || 0));
    const [currentStatus, setCurrentStatus] = useState<string>(quote.status);
    const [observations, setObservations] = useState<string>(quote.observations || '');
    const [isConverting, setIsConverting] = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [revalidationChanges, setRevalidationChanges] = useState<any[]>([]);
    const [showChangesModal, setShowChangesModal] = useState(false);

    // Order details form (when converting quote to order)
    const [orderName, setOrderName] = useState('');
    const [dispatchType, setDispatchType] = useState<string>('');
    const [pickupEntity, setPickupEntity] = useState('');
    const [pickupName, setPickupName] = useState('');
    const [carrierName, setCarrierName] = useState('');
    const [carrierAddress, setCarrierAddress] = useState('');
    const [carrierPhone, setCarrierPhone] = useState('');
    const [carrierContactName, setCarrierContactName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [clientCredit, setClientCredit] = useState<{
        hasCredit: boolean;
        creditLimit: number;
        availableCredit: number;
        externalDebt?: number;
        pendingOrdersSum?: number;
        portfolioBlocked?: boolean;
        portfolioBlockMessage?: string | null;
    } | null>(null);

    useEffect(() => {
        if (!quote.clientId) {
            setClientCredit(null);
            return;
        }
        let cancelled = false;
        fetch(`/api/users/${quote.clientId}`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled || !data.success || !data.data) return;
                const u = data.data;
                const hasCredit = Boolean(u.hasCredit);
                const creditLimit = u.creditLimit != null ? Number(u.creditLimit) : 0;
                const availableCredit = typeof u.availableCredit === 'number' ? u.availableCredit : (hasCredit ? creditLimit : 0);
                const externalDebt = typeof u.externalDebt === 'number' ? u.externalDebt : 0;
                const pendingOrdersSum = typeof u.pendingOrdersSum === 'number' ? u.pendingOrdersSum : 0;
                const portfolioBlocked = Boolean(u.portfolioBlocked);
                const portfolioBlockMessage =
                    typeof u.portfolioBlockMessage === 'string' ? u.portfolioBlockMessage : null;
                setClientCredit({
                    hasCredit,
                    creditLimit,
                    availableCredit,
                    externalDebt,
                    pendingOrdersSum,
                    portfolioBlocked,
                    portfolioBlockMessage,
                });
            })
            .catch(() => setClientCredit(null));
        return () => { cancelled = true; };
    }, [quote.clientId]);
    // const [cancellationReason, setCancellationReason] = useState<string>(quote.cancellationReason || ''); // Temporarily commented out
    const calcQuoteTotal = (q: Quote) => {
        try {
            const apiTotal = Number(q.totalAmount);
            if (Number.isFinite(apiTotal) && apiTotal >= 0) return apiTotal;
        } catch (_) { }
        try {
            const sum = (q.items || []).reduce((acc: number, it: any) => {
                const quantity = Number(typeof it.quantity === 'number' ? it.quantity : 1);
                const unit = Number(typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0));
                const line = roundMoney2(
                    Number(typeof it.totalPrice === 'number' ? it.totalPrice : unit * quantity)
                );
                return acc + (Number.isFinite(line) ? line : 0);
            }, 0);
            return roundMoney2(sum);
        } catch (_) {
            return 0;
        }
    };
    const clampDiscount = (d: number) => {
        const n = Number(d);
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
    };
    const computeTotals = (q: Quote, discount: number) => {
        const subtotal = roundMoney2(calcQuoteTotal(q));
        const d = clampDiscount(discount);
        const total = roundMoney2(subtotal * (1 - d / 100));
        return { subtotal, discountPercent: d, total };
    };
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'bg-blue-100 text-blue-800';
            case 'closed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'running': return 'En Proceso';
            case 'closed': return 'Cerrado';
            case 'cancelled': return 'Cancelado';
            default: return status;
        }
    };

    const handleConvertToOrder = async () => {
        // Validation: Quote must have a client assigned
        if (!quote.clientId) {
            toast.error('Esta cotización no tiene un cliente asignado. Por favor asigna un cliente antes de convertirla en orden.');
            return;
        }

        if (clientCredit?.portfolioBlocked) {
            toast.error(
                clientCredit.portfolioBlockMessage ||
                    'Cartera vencida: el cliente debe regularizar facturas en mora antes de convertir a orden.'
            );
            return;
        }

        // Si es cliente, re-validar precios primero
        if (session?.user?.role === 'client') {
            setIsRevalidating(true);
            try {
                const revalidateResponse = await fetch(`/api/quotes/${quote.id}/revalidate`, {
                    method: 'POST',
                });

                if (!revalidateResponse.ok) {
                    throw new Error('Error al validar precios actuales');
                }

                const revalidateData = await revalidateResponse.json();

                if (revalidateData.hasChanges) {
                    // Mostrar modal de cambios
                    setRevalidationChanges(revalidateData.changes);
                    setShowChangesModal(true);
                    setIsRevalidating(false);
                    return; // Esperar aprobación del cliente
                }
            } catch (error: any) {
                toast.error(error.message || 'Error al validar precios');
                setIsRevalidating(false);
                return;
            } finally {
                setIsRevalidating(false);
            }
        }

        // Continuar con conversión normal
        await proceedWithConversion();
    };

    const totalsForConversion = computeTotals(quote, discountPercent);
    const internationalWeightLbsForQuote = computeTotalOrderWeightLbs(quote.items ?? []);
    const internationalCarrierSurchargeUsd =
        dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER
            ? computeInternationalCarrierSurchargeUsd(internationalWeightLbsForQuote).feeUsd
            : 0;
    const orderGrandTotalWithCarrierUsd =
        Math.round((totalsForConversion.total + internationalCarrierSurchargeUsd) * 100) / 100;
    const hasMissingWeightQuoteLines = (quote.items || []).some(
        (it: any) =>
            (Number(it.quantity) || 0) > 0 &&
            (typeof it.weightPoundsPerUnit !== 'number' || !Number.isFinite(it.weightPoundsPerUnit))
    );

    const canUseCreditLine = Boolean(
        quote.clientId &&
        clientCredit?.hasCredit &&
        clientCredit.availableCredit >= orderGrandTotalWithCarrierUsd &&
        orderGrandTotalWithCarrierUsd > 0
    );

    // Block converting to order when client has credit and quote total exceeds available credit (debt over limit)
    const isBlockedByCredit = Boolean(
        quote.clientId &&
        clientCredit?.hasCredit &&
        orderGrandTotalWithCarrierUsd > 0 &&
        orderGrandTotalWithCarrierUsd > clientCredit.availableCredit
    );

    const isBlockedByPortfolio = Boolean(quote.clientId && clientCredit?.portfolioBlocked);

    const validateOrderDetailsForConversion = (): boolean => {
        if (dispatchType === DISPATCH_TYPE_PICKUP) {
            if (!isValidPickupEntity(pickupEntity) || !pickupName.trim()) {
                toast.error('Cuando el cliente recoge en bodega, seleccione Persona o Empresa e indique el nombre');
                return false;
            }
        }
        if (dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER) {
            if (!carrierName.trim() || !carrierAddress.trim() || !carrierPhone.trim() || !carrierContactName.trim()) {
                toast.error('Cuando envía a transportador internacional, complete todos los campos de la transportadora');
                return false;
            }
        }
        if (isBlockedByPortfolio) {
            toast.error(
                clientCredit?.portfolioBlockMessage ||
                    'Cartera vencida: no se pueden generar órdenes hasta regularizar la cartera.'
            );
            return false;
        }
        if (isBlockedByCredit) {
            toast.error('No puede generar la orden hasta que su cuenta esté por debajo del límite de crédito. Cupo disponible: ' + formatCurrency(clientCredit?.availableCredit ?? 0, 'USD'));
            return false;
        }
        if (paymentMethod === PAYMENT_METHOD_CREDIT_LINE && !canUseCreditLine) {
            toast.error(clientCredit?.hasCredit ? 'Cupo de crédito insuficiente' : 'Crédito no disponible para este cliente');
            return false;
        }
        return true;
    };

    const proceedWithConversion = async () => {
        if (!validateOrderDetailsForConversion()) return;

        // Confirmation dialog
        const confirmed = window.confirm(
            `¿Estás seguro de convertir la cotización #${quote.id} en una orden?\n\n` +
            `Cliente: ${quote.clientName || 'ID: ' + quote.clientId}\n` +
            `Total: ${formatCurrency(orderGrandTotalWithCarrierUsd, 'USD')}\n\n` +
            `Esta acción:\n` +
            `• Creará una nueva orden con los mismos items\n` +
            `• Cambiará el estado de la cotización a "Cerrado"\n` +
            `• Te redirigirá a la página de órdenes`
        );

        if (!confirmed) return;

        try {
            setIsConverting(true);
            toast.loading('Convirtiendo cotización en orden...', { id: 'convert-order' });

            // Create order with POST to /api/orders (include order details)
            const orderResponse = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: quote.clientId,
                    clientName: quote.clientName,
                    clientType: quote.clientType,
                    items: quote.items,
                    totalAmount: orderGrandTotalWithCarrierUsd,
                    observations: observations.trim() || `Orden generada desde cotización #${quote.id}`,
                    orderName: orderName.trim() || null,
                    dispatchType: dispatchType || null,
                    pickupEntity: dispatchType === DISPATCH_TYPE_PICKUP ? pickupEntity.trim() || null : null,
                    pickupName: dispatchType === DISPATCH_TYPE_PICKUP ? pickupName.trim() || null : null,
                    carrierName: dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER ? carrierName.trim() || null : null,
                    carrierAddress: dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER ? carrierAddress.trim() || null : null,
                    carrierPhone: dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER ? carrierPhone.trim() || null : null,
                    carrierContactName: dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER ? carrierContactName.trim() || null : null,
                    paymentMethod: paymentMethod || null,
                }),
            });

            const orderData = await orderResponse.json();

            if (!orderResponse.ok) {
                throw new Error(orderData.error || 'No se pudo crear la orden');
            }

            if (paymentMethod === PAYMENT_METHOD_STRIPE) {
                const checkoutResponse = await fetch('/api/payments/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: orderData.data.id,
                    }),
                });
                const checkoutData = await checkoutResponse.json().catch(() => ({}));
                if (!checkoutResponse.ok || !checkoutData.checkoutUrl) {
                    throw new Error(checkoutData?.error || 'No fue posible iniciar Stripe Checkout');
                }
                window.location.href = checkoutData.checkoutUrl;
                return;
            }

            // Update quote status to "closed" (won)
            const quoteResponse = await fetch(`/api/quotes/${quote.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                                    status: 'closed',
                                    discountPercent: discountPercent,
                                    observations: observations.trim() || null,
                }),
            });

            if (!quoteResponse.ok) {
                const quoteError = await quoteResponse.json();
                console.warn('Order created but could not update quote status:', quoteError);
                // Still show success because order was created
            }

            const newOrderId = orderData.data.id;
            if (paymentMethod === PAYMENT_METHOD_TRANSFER || paymentMethod === PAYMENT_METHOD_ZELLE) {
                toast.success(
                    `Orden #${newOrderId} registrada (cotización #${quote.id}). Envíe el comprobante a ${ORDER_PAYMENT_PROOF_EMAIL} con el N.º de orden; se procesa al validar el pago.`,
                    { id: 'convert-order', duration: 7000 }
                );
            } else {
                toast.success(`Orden #${newOrderId} creada exitosamente desde cotización #${quote.id}`, {
                    id: 'convert-order',
                    duration: 4000,
                });
            }

            // Close modal and refresh quotes list
            onClose();
            onQuoteUpdated();

            // Redirect to orders page after a short delay
            setTimeout(() => {
                router.push('/orders');
            }, 1000);

        } catch (error: any) {
            console.error('Error converting quote to order:', error);
            toast.error(
                error.message || 'Error al convertir la cotización en orden',
                { id: 'convert-order' }
            );
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

                <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
                    <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                Cotización #{quote.id}
                            </h3>
                            <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
                                    {getStatusText(currentStatus)}
                                </span>
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Quote Info */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Agente</label>
                                    <p className="mt-1 text-sm text-gray-900">{quote.agent?.username || `ID: ${quote.agentId}`}</p>
                                    {quote.agent?.email && (
                                        <p className="text-xs text-gray-500">{quote.agent.email}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                                    {session?.user?.role === 'client' ? (
                                        <p className="mt-1 text-sm text-gray-900">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
                                                {getStatusText(currentStatus)}
                                            </span>
                                        </p>
                                    ) : (
                                        <select
                                            value={currentStatus}
                                            onChange={(e) => setCurrentStatus(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        >
                                            <option value="running">En Proceso</option>
                                            <option value="closed">Cerrado</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    )}
                                </div>
                                {/* Temporarily commented out - cancellation reason UI
                    {currentStatus === 'cancelled' && (
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Motivo de Cancelación <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                                rows={3}
                                placeholder="Ingrese el motivo de la cancelación..."
                                required
                            />
                            {currentStatus === 'cancelled' && !cancellationReason.trim() && (
                                <p className="mt-1 text-sm text-red-600">El motivo de cancelación es requerido</p>
                            )}
                        </div>
                    )}
                    */}
                                {quote.clientName && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Cliente</label>
                                        <p className="mt-1 text-sm text-gray-900">{quote.clientName}</p>
                                        {quote.clientType && (
                                            <p className="text-xs text-gray-500">Tipo: {quote.clientType}</p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Fecha de Creación</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        {new Date(quote.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Observaciones</label>
                                    <textarea
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        rows={3}
                                        placeholder="Agregar observaciones sobre la cotización..."
                                    />
                                </div>
                                {/* Temporarily commented out - cancellation reason display
                                {quote.status === 'cancelled' && quote.cancellationReason && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Motivo de Cancelación</label>
                                        <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                                            <p className="text-sm text-red-800">{quote.cancellationReason}</p>
                                        </div>
                                    </div>
                                )}
                                */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Totales</label>
                                    <div className="mt-1 text-sm text-gray-900 space-y-0.5">
                                        <p>Subtotal: {formatCurrency(calcQuoteTotal(quote), 'USD')}</p>
                                        {session?.user?.role !== 'client' && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span>Desc (%):</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={discountPercent}
                                                        onChange={(e) => setDiscountPercent(clampDiscount(Number(e.target.value)))}
                                                        className="w-20 text-sm border border-gray-300 rounded px-1 py-0.5"
                                                    />
                                                    <span>-{formatCurrency(calcQuoteTotal(quote) * clampDiscount(discountPercent) / 100, 'USD')}</span>
                                                </div>
                                            </>
                                        )}
                                        <p className="text-base font-semibold">Total: {formatCurrency(orderGrandTotalWithCarrierUsd, 'USD')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Ítems ({quote.items.length})</h4>
                                <div className="space-y-3">
                                    {quote.items.map((item, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <h5 className="text-sm font-medium text-gray-900">
                                                            {item.reference}
                                                        </h5>
                                                        {item.brand && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                                {item.brand}
                                                            </span>
                                                        )}
                                                        {/* Show source for all items */}
                                                        {item.sourceName && (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                item.sourceName === 'Interno' 
                                                                    ? 'bg-blue-100 text-blue-800'
                                                                    : item.sourceName === 'Costex'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                                {item.sourceName === 'Costex' ? 'Importacion' : item.sourceName}
                                                            </span>
                                                        )}
                                                        {item.source === 'third-party' && !item.sourceName && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                                Proveedor Externo
                                                            </span>
                                                        )}
                                                        {item.isManual && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                Manual
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {formatCurrency(item.unitPrice, 'USD')} c/u
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Cantidad: {item.quantity}
                                                    </p>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        Total: {formatCurrency(item.totalPrice, 'USD')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Order details form - when converting to order */}
                            {quote.clientId && !['closed', 'cancelled'].includes(currentStatus) && (
                                <div className="border-t border-gray-200 pt-4 space-y-4">
                                    <h4 className="text-sm font-medium text-gray-900">Detalles de la orden (al convertir)</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre para la orden</label>
                                        <input
                                            type="text"
                                            value={orderName}
                                            onChange={(e) => setOrderName(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                            placeholder="Ej: Orden 123, Compra febrero 2025"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones de despacho</label>
                                        <select
                                            value={dispatchType}
                                            onChange={(e) => setDispatchType(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                        >
                                            <option value="">Seleccione...</option>
                                            <option value={DISPATCH_TYPE_PICKUP}>El cliente lo recoge en bodega IPMach</option>
                                            <option value={DISPATCH_TYPE_INTERNATIONAL_CARRIER}>IPMach envía a Transportador internacional (en Miami)</option>
                                        </select>
                                        {dispatchType === DISPATCH_TYPE_PICKUP && (
                                            <div className="mt-2 space-y-2">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Quién recoge (Persona o Empresa)
                                                    </label>
                                                    <select
                                                        value={pickupEntity}
                                                        onChange={(e) => setPickupEntity(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-white"
                                                    >
                                                        <option value="">Seleccione...</option>
                                                        <option value={PICKUP_ENTITY_PERSON}>{PICKUP_ENTITY_PERSON}</option>
                                                        <option value={PICKUP_ENTITY_COMPANY}>{PICKUP_ENTITY_COMPANY}</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                                    <input
                                                        type="text"
                                                        value={pickupName}
                                                        onChange={(e) => setPickupName(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                                        placeholder="Nombre de quien recoge"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER && (
                                            <div className="mt-2 space-y-2">
                                                <input
                                                    type="text"
                                                    value={carrierName}
                                                    onChange={(e) => setCarrierName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                                    placeholder="Nombre de la transportadora"
                                                />
                                                <input
                                                    type="text"
                                                    value={carrierAddress}
                                                    onChange={(e) => setCarrierAddress(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                                    placeholder="Dirección"
                                                />
                                                <input
                                                    type="text"
                                                    value={carrierPhone}
                                                    onChange={(e) => setCarrierPhone(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                                    placeholder="Teléfono de contacto"
                                                />
                                                <input
                                                    type="text"
                                                    value={carrierContactName}
                                                    onChange={(e) => setCarrierContactName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                                    placeholder="Nombre de contacto"
                                                />
                                            </div>
                                        )}
                                        {dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER && (
                                            <InternationalCarrierShippingNotice
                                                totalWeightLbs={internationalWeightLbsForQuote}
                                                surchargeFeeUsd={internationalCarrierSurchargeUsd}
                                                lineSubtotalUsd={totalsForConversion.total}
                                                grandTotalUsd={orderGrandTotalWithCarrierUsd}
                                                hasMissingWeightOnSomeLines={hasMissingWeightQuoteLines}
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones de pago</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                                        >
                                            <option value="">Seleccione...</option>
                                            <option value={PAYMENT_METHOD_CREDIT_LINE} disabled={!canUseCreditLine}>
                                                Pago con línea de crédito
                                                {!clientCredit?.hasCredit && ' (Crédito no disponible)'}
                                                {clientCredit?.hasCredit && !canUseCreditLine && orderGrandTotalWithCarrierUsd > 0 && ' (Cupo insuficiente)'}
                                            </option>
                                            <option value={PAYMENT_METHOD_TRANSFER}>Transferencia Bancaria</option>
                                            <option value={PAYMENT_METHOD_ZELLE}>Zelle</option>
                                            <option value={PAYMENT_METHOD_STRIPE}>Pago con tarjeta (Stripe)</option>
                                        </select>
                                        {paymentMethod === PAYMENT_METHOD_TRANSFER && (
                                            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700 space-y-1">
                                                <div><span className="font-medium">Beneficiario:</span> {PAYMENT_TRANSFER_DETAILS.beneficiaryName}</div>
                                                <div><span className="font-medium">Dirección:</span> {PAYMENT_TRANSFER_DETAILS.beneficiaryAddress}</div>
                                                <div><span className="font-medium">Banco:</span> {PAYMENT_TRANSFER_DETAILS.bankName}</div>
                                                <div><span className="font-medium">Número de cuenta:</span> {PAYMENT_TRANSFER_DETAILS.accountNumber}</div>
                                                <div><span className="font-medium">SWIFT:</span> {PAYMENT_TRANSFER_DETAILS.swift}</div>
                                                <div><span className="font-medium">Ruta ABA:</span> {PAYMENT_TRANSFER_DETAILS.routingAba}</div>
                                            </div>
                                        )}
                                        {paymentMethod === PAYMENT_METHOD_ZELLE && (
                                            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
                                                Nuestro Zelle: <a href={`mailto:${ZELLE_EMAIL}`} className="text-blue-600 hover:underline">{ZELLE_EMAIL}</a>
                                            </div>
                                        )}
                                        {(paymentMethod === PAYMENT_METHOD_TRANSFER ||
                                            paymentMethod === PAYMENT_METHOD_ZELLE) && <PaymentProofNotice />}
                                        {paymentMethod === PAYMENT_METHOD_STRIPE && (
                                            <StripeFeeNotice
                                                orderTotalUsd={orderGrandTotalWithCarrierUsd}
                                                variant="convert-quote"
                                            />
                                        )}
                                        {clientCredit?.hasCredit && (
                                            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                                                <span className="font-medium">Cupo disponible (estimado):</span>{' '}
                                                {formatCurrency(clientCredit.availableCredit, 'USD')}
                                                {' · '}
                                                <Link href="/credit" className="text-blue-600 hover:underline font-medium">
                                                    Crédito y cartera
                                                </Link>
                                            </div>
                                        )}
                                        {clientCredit && !clientCredit.hasCredit && (
                                            <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
                                                ¿Línea de crédito con Proshel?{' '}
                                                <Link href="/credit" className="text-blue-600 hover:underline font-medium">
                                                    Información y cómo solicitarla
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {isBlockedByPortfolio && (
                        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                            {clientCredit?.portfolioBlockMessage ||
                                'Cartera vencida: no se pueden generar órdenes hasta regularizar la cartera.'}
                        </div>
                    )}

                    {isBlockedByCredit && (
                        <div className="mx-4 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                            No puede generar la orden hasta que su cuenta o deuda general esté por debajo del límite de crédito. Cupo disponible: {formatCurrency(clientCredit?.availableCredit ?? 0, 'USD')}.
                        </div>
                    )}

                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
                        {session?.user?.role !== 'client' && (
                            <button
                                onClick={() => {
                                    // Load into search for editing
                                    loadQuote({
                                    id: String(quote.id),
                                    items: (quote.items || []).map((it: any) => ({
                                        id: it.id || `${it.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                        reference: it.reference,
                                        stockQty: typeof it.stockQty === 'number' ? it.stockQty : 0,
                                        basePriceCOP: typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0),
                                        clientPriceCOP: typeof it.clientPriceCOP === 'number' ? it.clientPriceCOP : undefined,
                                        hasStock: typeof it.hasStock === 'boolean' ? it.hasStock : true,
                                        location: it.location,
                                        description: it.description,
                                        quantity: typeof it.quantity === 'number' ? it.quantity : 1,
                                        unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0),
                                        totalPrice: typeof it.totalPrice === 'number' ? it.totalPrice : ((typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0)) * (typeof it.quantity === 'number' ? it.quantity : 1)),
                                        source: it.source,
                                        sourceName: it.sourceName,
                                        weightPoundsPerUnit:
                                            typeof it.weightPoundsPerUnit === 'number' && Number.isFinite(it.weightPoundsPerUnit)
                                                ? it.weightPoundsPerUnit
                                                : undefined,
                                    })),
                                    clientId: quote.clientId,
                                    clientName: quote.clientName,
                                    clientType: quote.clientType,
                                    agentId: quote.agentId,
                                });
                                onClose();
                                router.push('/search');
                            }}
                            className="btn-primary flex items-center space-x-2"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            <span>Editar</span>
                        </button>
                        )}
                        {session?.user?.role !== 'client' && (
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`/api/quotes/${quote.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                status: currentStatus,
                                                discountPercent: discountPercent,
                                                observations: observations.trim() || null,
                                            }),
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
                                        toast.success('Estado, descuento e IVA guardados');
                                        onClose();
                                        onQuoteUpdated();
                                    } catch (e: any) {
                                        toast.error(e.message || 'Error al guardar');
                                    }
                                }}
                                className="btn-secondary flex items-center space-x-2 mt-3 sm:mt-0"
                            >
                                <span>Guardar</span>
                            </button>
                        )}
                        
                        {/* Convert to Order Button - Only show if quote has client and is not already closed/cancelled */}
                        {quote.clientId && !['closed', 'cancelled'].includes(currentStatus) && (
                            <button
                                onClick={handleConvertToOrder}
                                disabled={
                                    isConverting ||
                                    isRevalidating ||
                                    isBlockedByPortfolio ||
                                    isBlockedByCredit ||
                                    (paymentMethod === PAYMENT_METHOD_CREDIT_LINE && !canUseCreditLine)
                                }
                                className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed mt-3 sm:mt-0"
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                <span>{isRevalidating ? 'Validando precios...' : isConverting ? 'Convirtiendo...' : 'Convertir a Orden'}</span>
                            </button>
                        )}
                        
                        <button
                            onClick={async () => {
                                if (isExportingPDF) return;
                                setIsExportingPDF(true);
                                try {
                                    // Save current discount/status/observations so the PDF reflects what the user sees
                                    const res = await fetch(`/api/quotes/${quote.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            status: currentStatus,
                                            discountPercent: discountPercent,
                                            observations: observations.trim() || null,
                                        }),
                                    });
                                    if (!res.ok) {
                                        const data = await res.json().catch(() => ({}));
                                        throw new Error(data?.error || 'No se pudo guardar');
                                    }
                                    onQuoteUpdated();
                                    onExportPDF();
                                } catch (e: any) {
                                    toast.error(e.message || 'Error al guardar antes de exportar');
                                } finally {
                                    setIsExportingPDF(false);
                                }
                            }}
                            disabled={isExportingPDF}
                            className="btn-primary flex items-center space-x-2 mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                            <span>{isExportingPDF ? 'Guardando...' : 'Exportar PDF'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="btn-secondary mt-3 sm:mt-0"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de cambios de precio/inventario */}
            {showChangesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowChangesModal(false)} />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Cambios Detectados en la Cotización
                        </h3>
                        
                        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                            {revalidationChanges.map((change, idx) => (
                                <div key={idx} className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                                    <p className="font-semibold text-gray-900">{change.reference}</p>
                                    
                                    {change.priceChanged && (
                                        <div className="mt-2 text-sm">
                                            <p className="text-gray-700">Precio:</p>
                                            <p className="text-red-600">
                                                Anterior: {formatCurrency(change.oldPrice, 'USD')}
                                            </p>
                                            <p className={change.newPrice > change.oldPrice ? 'text-red-600' : 'text-green-600'}>
                                                Actual: {formatCurrency(change.newPrice, 'USD')}
                                                {change.newPrice > change.oldPrice && ' (aumento)'}
                                                {change.newPrice < change.oldPrice && ' (disminución)'}
                                            </p>
                                        </div>
                                    )}
                                    
                                    {change.stockDecreased && (
                                        <div className="mt-2 text-sm">
                                            <p className="text-gray-700">Inventario:</p>
                                            <p className="text-red-600">
                                                Anterior: {change.oldStock} unidades
                                            </p>
                                            <p className="text-red-600">
                                                Actual: {change.newStock} unidades (disminuyó)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowChangesModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setShowChangesModal(false);
                                    await proceedWithConversion();
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                            >
                                Aprobar y Crear Orden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
