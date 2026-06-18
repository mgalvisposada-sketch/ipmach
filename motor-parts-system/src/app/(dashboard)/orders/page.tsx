'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import {
    EyeIcon,
    DocumentArrowDownIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CalendarIcon,
    BuildingOfficeIcon,
    XMarkIcon,
    DocumentTextIcon,
    CreditCardIcon,
} from '@heroicons/react/24/outline';
import { PAYMENT_METHOD_STRIPE } from '@/lib/order-details-constants';
import { getOrderPaymentSummaryLine } from '@/lib/order-payment-status';

function StripeReturnSync({ onSynced }: { onSynced: () => void }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const processedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!searchParams) {
            return;
        }
        const payment = searchParams.get('payment');
        const orderId = searchParams.get('orderId');
        const sessionId = searchParams.get('session_id');
        if (!payment) {
            return;
        }

        const dedupeKey = `${payment}-${orderId ?? ''}-${sessionId ?? ''}`;
        if (processedRef.current === dedupeKey) {
            return;
        }

        const cleanUrl = () => router.replace('/orders', { scroll: false });

        if (payment === 'success' && orderId && !sessionId) {
            processedRef.current = dedupeKey;
            toast.success('Pago registrado correctamente');
            onSynced();
            cleanUrl();
            return;
        }

        if (payment === 'pending' && orderId) {
            processedRef.current = dedupeKey;
            toast('El pago puede estar en proceso. Verifique el estado en un momento.', { icon: 'ℹ️' });
            onSynced();
            cleanUrl();
            return;
        }

        if (payment === 'error' || payment === 'invalid') {
            processedRef.current = dedupeKey;
            toast.error('No se pudo confirmar el pago con Stripe');
            cleanUrl();
            return;
        }

        if (payment === 'success' && sessionId) {
            processedRef.current = dedupeKey;
            let cancelled = false;
            (async () => {
                try {
                    const res = await fetch('/api/payments/confirm-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (cancelled) {
                        return;
                    }
                    if (res.ok && data.paymentStatus === 'paid') {
                        toast.success('Pago registrado correctamente');
                        onSynced();
                    } else if (!res.ok) {
                        toast.error(data?.error || 'No se pudo confirmar el pago');
                    }
                } catch {
                    if (!cancelled) {
                        toast.error('Error al confirmar el pago');
                    }
                } finally {
                    if (!cancelled) {
                        cleanUrl();
                    }
                }
            })();
            return () => {
                cancelled = true;
            };
        }

        return undefined;
    }, [searchParams, onSynced, router]);

    return null;
}

interface Order {
    id: number;
    clientId: number;
    clientName?: string;
    clientType?: number;
    items: any[];
    status: string;
    totalAmount: number;
    createdAt: string;
    updatedAt: string;
    observations?: string;
    orderName?: string | null;
    dispatchType?: string | null;
    pickupEntity?: string | null;
    pickupName?: string | null;
    carrierName?: string | null;
    carrierAddress?: string | null;
    carrierPhone?: string | null;
    carrierContactName?: string | null;
    paymentMethod?: string | null;
    /** Stripe / internal: pending_payment | paid | failed | not_required */
    paymentStatus?: string | null;
    client?: {
        id: number;
        username: string;
        email: string;
        role: string;
    };
}

interface OrderFilters {
    status: string;
    clientId: string;
    dateFrom: string;
    dateTo: string;
}

export default function OrdersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filters, setFilters] = useState<OrderFilters>({
        status: '',
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

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();

            if (filters.status) queryParams.append('status', filters.status);
            if (filters.clientId) queryParams.append('clientId', filters.clientId);
            if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

            const response = await fetch(`/api/orders?${queryParams.toString()}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Failed to fetch orders: ${response.status}`);
            }

            const data = await response.json();
            setOrders(data.data || []);
        } catch (error: any) {
            console.error('Error fetching orders:', error);
            toast.error(error.message || 'Error al cargar las órdenes');
            // Don't redirect, just show error and empty orders
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (status === 'authenticated') {
            fetchOrders();
        }
    }, [status, fetchOrders]);

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setShowDetails(true);
    };

    const handleExportPDF = async (order: Order) => {
        try {
            toast.loading('Generando PDF...', { id: 'pdf-export' });

            const response = await fetch(`/api/orders/${order.id}/export?printReference=${printReference ? '1' : '0'}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `orden-${order.id}.pdf`;
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

    const calcOrderTotal = (order: Order) => {
        try {
            const apiTotal = Number(order.totalAmount);
            if (Number.isFinite(apiTotal) && apiTotal >= 0) return apiTotal;
        } catch (_) { }
        try {
            const sum = (order.items || []).reduce((acc: number, it: any) => {
                const quantity = Number(typeof it.quantity === 'number' ? it.quantity : 1);
                const unit = Number(typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0));
                const total = Number(typeof it.totalPrice === 'number' ? it.totalPrice : unit * quantity);
                return acc + (Number.isFinite(total) ? total : 0);
            }, 0);
            return sum;
        } catch (_) {
            return 0;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'processing': return 'bg-purple-100 text-purple-800';
            case 'shipped': return 'bg-indigo-100 text-indigo-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'confirmed': return 'Confirmada';
            case 'processing': return 'En Proceso';
            case 'shipped': return 'Enviada';
            case 'delivered': return 'Entregada';
            case 'cancelled': return 'Cancelada';
            default: return status;
        }
    };

    const filteredOrders = orders.filter(order => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            order.id.toString().includes(searchLower) ||
            order.clientName?.toLowerCase().includes(searchLower) ||
            order.items.some(item =>
                item.reference?.toLowerCase().includes(searchLower) ||
                item.description?.toLowerCase().includes(searchLower)
            )
        );
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
                    <p className="mt-1 text-sm text-gray-500">Gestiona y visualiza todas las órdenes.</p>
                </div>
                <div className="card">
                    <div className="card-body text-center py-12">
                        <div className="spinner mx-auto h-8 w-8"></div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Cargando órdenes...</h3>
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

    const isAdmin = session?.user?.role === 'admin';
    const isAgent = session?.user?.role === 'agent';
    const isAdminOrAgent = isAdmin || isAgent;

    return (
        <div className="space-y-6">
            <Suspense fallback={null}>
                <StripeReturnSync onSynced={fetchOrders} />
            </Suspense>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
                <p className="mt-1 text-sm text-gray-500">
                    {isAdminOrAgent ? 'Gestiona y visualiza todas las órdenes.' : 'Visualiza tus órdenes.'}
                </p>
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
                                <option value="pending">Pendiente</option>
                                <option value="confirmed">Confirmada</option>
                                <option value="processing">En Proceso</option>
                                <option value="shipped">Enviada</option>
                                <option value="delivered">Entregada</option>
                                <option value="cancelled">Cancelada</option>
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

            {/* Orders List */}
            <div className="card">
                <div className="card-header">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">
                            Órdenes ({filteredOrders.length})
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
                                onClick={fetchOrders}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <FunnelIcon className="h-4 w-4" />
                                <span>Actualizar</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay órdenes</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                No se encontraron órdenes con los filtros aplicados.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredOrders.map((order) => (
                                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3">
                                                <h3 className="text-lg font-medium text-gray-900">
                                                    Orden #{order.id}
                                                </h3>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                    {getStatusText(order.status)}
                                                </span>
                                            </div>
                                            <div className="mt-1.5">
                                                {(() => {
                                                    const pay = getOrderPaymentSummaryLine(order);
                                                    return (
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                pay.variant === 'paid'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : pay.variant === 'failed'
                                                                      ? 'bg-red-100 text-red-800'
                                                                      : 'bg-amber-100 text-amber-900'
                                                            }`}
                                                        >
                                                            {pay.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>

                                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-gray-600">
                                                <div className="flex items-center space-x-2">
                                                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                                                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                {isAdminOrAgent && order.clientName && (
                                                    <div className="flex items-center space-x-2">
                                                        <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                                                        <span>{order.clientName}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center space-x-2">
                                                    <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                                                    <span>{order.items.length} ítems</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 ml-4">
                                            <div className="text-right">
                                                <div className="text-lg font-semibold text-gray-900">
                                                    {formatCurrency(calcOrderTotal(order), 'USD')}
                                                </div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleViewDetails(order)}
                                                    className="btn-secondary flex items-center space-x-1"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                    <span>Ver</span>
                                                </button>
                                                <button
                                                    onClick={() => handleExportPDF(order)}
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
                    )}
                </div>
            </div>

            {/* Order Details Modal */}
            {showDetails && selectedOrder && (
                <OrderDetailsModal
                    order={selectedOrder}
                    onClose={() => setShowDetails(false)}
                    onExportPDF={() => handleExportPDF(selectedOrder)}
                    onOrderUpdated={fetchOrders}
                    isAdmin={isAdminOrAgent}
                />
            )}
        </div>
    );
}

// Order Details Modal Component
function OrderDetailsModal({ order, onClose, onExportPDF, onOrderUpdated, isAdmin }: {
    order: Order;
    onClose: () => void;
    onExportPDF: () => void;
    onOrderUpdated: () => void;
    isAdmin: boolean; // This now represents admin OR agent
}) {
    const [currentStatus, setCurrentStatus] = useState<string>(order.status);
    const [observations, setObservations] = useState<string>(order.observations || '');
    const [isRetryingStripe, setIsRetryingStripe] = useState(false);

    const effectivePaymentStatus =
        order.paymentStatus ??
        (order.paymentMethod === PAYMENT_METHOD_STRIPE ? 'pending_payment' : null);

    const canRetryStripePayment =
        order.paymentMethod === PAYMENT_METHOD_STRIPE &&
        order.status !== 'cancelled' &&
        effectivePaymentStatus !== 'paid' &&
        effectivePaymentStatus !== 'not_required';

    const paymentSummary = getOrderPaymentSummaryLine(order);

    const handleRetryStripePayment = async () => {
        setIsRetryingStripe(true);
        try {
            toast.loading('Abriendo pago seguro…', { id: 'stripe-retry' });
            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.checkoutUrl) {
                throw new Error(data?.error || 'No fue posible iniciar el pago.');
            }
            toast.dismiss('stripe-retry');
            window.location.href = data.checkoutUrl;
        } catch (e: any) {
            toast.error(e?.message || 'Error al abrir Stripe', { id: 'stripe-retry' });
            setIsRetryingStripe(false);
        }
    };

    const calcOrderTotal = (o: Order) => {
        try {
            const apiTotal = Number(o.totalAmount);
            if (Number.isFinite(apiTotal) && apiTotal >= 0) return apiTotal;
        } catch (_) { }
        try {
            const sum = (o.items || []).reduce((acc: number, it: any) => {
                const quantity = Number(typeof it.quantity === 'number' ? it.quantity : 1);
                const unit = Number(typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.basePriceCOP === 'number' ? it.basePriceCOP : 0));
                const total = Number(typeof it.totalPrice === 'number' ? it.totalPrice : unit * quantity);
                return acc + (Number.isFinite(total) ? total : 0);
            }, 0);
            return sum;
        } catch (_) {
            return 0;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'processing': return 'bg-purple-100 text-purple-800';
            case 'shipped': return 'bg-indigo-100 text-indigo-800';
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'confirmed': return 'Confirmada';
            case 'processing': return 'En Proceso';
            case 'shipped': return 'Enviada';
            case 'delivered': return 'Entregada';
            case 'cancelled': return 'Cancelada';
            default: return status;
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
                                Orden #{order.id}
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
                            {/* Order Info */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {isAdmin && order.clientName && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Cliente</label>
                                        <p className="mt-1 text-sm text-gray-900">{order.clientName}</p>
                                        {order.clientType && (
                                            <p className="text-xs text-gray-500">Tipo: {order.clientType}</p>
                                        )}
                                    </div>
                                )}
                                {isAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Estado</label>
                                        <select
                                            value={currentStatus}
                                            onChange={(e) => setCurrentStatus(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        >
                                            <option value="pending">Pendiente</option>
                                            <option value="confirmed">Confirmada</option>
                                            <option value="processing">En Proceso</option>
                                            <option value="shipped">Enviada</option>
                                            <option value="delivered">Entregada</option>
                                            <option value="cancelled">Cancelada</option>
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Fecha de Creación</label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        {new Date(order.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Observaciones</label>
                                    {isAdmin ? (
                                        <textarea
                                            value={observations}
                                            onChange={(e) => setObservations(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                            rows={3}
                                            placeholder="Agregar observaciones sobre la orden..."
                                        />
                                    ) : (
                                        <p className="mt-1 text-sm text-gray-900">{observations || 'Sin observaciones'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Total</label>
                                    <p className="mt-1 text-lg font-semibold text-gray-900">
                                        {formatCurrency(calcOrderTotal(order), 'USD')}
                                    </p>
                                </div>
                                {(order.orderName || order.dispatchType || order.paymentMethod) && (
                                    <div className="sm:col-span-2 space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Detalles de la orden</label>
                                        <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-700 space-y-1">
                                            {order.orderName && (
                                                <div><span className="font-medium">Nombre:</span> {order.orderName}</div>
                                            )}
                                            {order.dispatchType && (
                                                <div>
                                                    <span className="font-medium">Despacho:</span>{' '}
                                                    {order.dispatchType === 'pickup'
                                                        ? 'Cliente recoge en bodega IPMach'
                                                        : order.dispatchType === 'international_carrier'
                                                            ? 'IPMach envía a transportador (Miami)'
                                                            : order.dispatchType}
                                                    {order.dispatchType === 'pickup' && (order.pickupEntity || order.pickupName) && (
                                                        <span> – {[order.pickupEntity, order.pickupName].filter(Boolean).join(', ')}</span>
                                                    )}
                                                    {order.dispatchType === 'international_carrier' && order.carrierName && (
                                                        <span> – {order.carrierName}</span>
                                                    )}
                                                </div>
                                            )}
                                            {order.paymentMethod && (
                                                <div>
                                                    <span className="font-medium">Pago:</span>{' '}
                                                    {order.paymentMethod === 'credit_line'
                                                        ? 'Línea de crédito'
                                                        : order.paymentMethod === 'transfer'
                                                            ? 'Transferencia bancaria'
                                                            : order.paymentMethod === 'zelle'
                                                                ? 'Zelle'
                                                                : order.paymentMethod === 'stripe'
                                                                    ? 'Tarjeta (Stripe)'
                                                                : order.paymentMethod}
                                                </div>
                                            )}
                                            {order.paymentMethod && (
                                                <div>
                                                    <span className="font-medium">Estado del pago:</span>{' '}
                                                    <span
                                                        className={
                                                            paymentSummary.variant === 'failed'
                                                                ? 'text-red-700 font-medium'
                                                                : paymentSummary.variant === 'paid'
                                                                  ? 'text-green-700 font-medium'
                                                                  : 'text-amber-800 font-medium'
                                                        }
                                                    >
                                                        {paymentSummary.label}
                                                    </span>
                                                </div>
                                            )}
                                            {canRetryStripePayment && (
                                                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                                                    Si el pago fue rechazado o cerró la ventana de Stripe, use{' '}
                                                    <strong>Reintentar pago con Stripe</strong> abajo.
                                                </p>
                                            )}
                                            {order.dispatchType === 'international_carrier' && (order.carrierAddress || order.carrierPhone || order.carrierContactName) && (
                                                <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                                                    {order.carrierAddress && <div>Dirección: {order.carrierAddress}</div>}
                                                    {order.carrierPhone && <div>Tel: {order.carrierPhone}</div>}
                                                    {order.carrierContactName && <div>Contacto: {order.carrierContactName}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-3">Ítems ({order.items.length})</h4>
                                <div className="space-y-3">
                                    {order.items.map((item, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 flex-wrap">
                                                        <h5 className="text-sm font-medium text-gray-900">
                                                            {item.reference}
                                                        </h5>
                                                        {/* Show origin/source only to admins - prefer sourceName (human-readable) over origin (code) */}
                                                        {isAdmin && (
                                                            <>
                                                                {/* Show sourceName if available (human-readable name) */}
                                                                {item.sourceName && item.sourceName !== 'Interno' && (
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.sourceName === 'Costex'
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : 'bg-purple-100 text-purple-800'
                                                                        }`}>
                                                                        {item.sourceName === 'Costex' ? 'Importacion' : item.sourceName}
                                                                    </span>
                                                                )}
                                                                {/* Fallback to origin code if sourceName not available */}
                                                                {(!item.sourceName || item.sourceName === 'Interno') && item.origin && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                                        {item.origin}
                                                                    </span>
                                                                )}
                                                            </>
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
                        </div>
                    </div>

                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:flex-wrap sm:gap-2 sm:px-6">
                        {canRetryStripePayment && (
                            <button
                                type="button"
                                onClick={handleRetryStripePayment}
                                disabled={isRetryingStripe}
                                className="btn-primary flex items-center justify-center space-x-2 mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CreditCardIcon className="h-4 w-4" />
                                <span>{isRetryingStripe ? 'Abriendo…' : 'Reintentar pago con Stripe'}</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`/api/orders/${order.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                status: currentStatus,
                                                observations: observations.trim() || null,
                                            }),
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data?.error || 'No se pudo guardar');
                                        toast.success('Orden actualizada');
                                        onClose();
                                        onOrderUpdated();
                                    } catch (e: any) {
                                        toast.error(e.message || 'Error al guardar');
                                    }
                                }}
                                className="btn-secondary flex items-center space-x-2 mt-3 sm:mt-0 sm:mr-3"
                            >
                                <span>Guardar</span>
                            </button>
                        )}
                        <button
                            onClick={onExportPDF}
                            className="btn-primary flex items-center space-x-2"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                            <span>Exportar PDF</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="btn-secondary mt-3 sm:mt-0 sm:mr-3"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}




