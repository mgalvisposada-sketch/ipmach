'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { XMarkIcon, DocumentTextIcon, TrashIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';
import { useQuote } from '@/contexts/QuoteContext';
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

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
}

interface OrderItem {
    id: string;
    reference: string;
    stockQty?: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isManual?: boolean;
    source?: 'internal' | 'third-party';
    sourceName?: string;
    origin?: string; // Origin code (e.g., 'agrocosta', 'gecolsa') - hidden from clients
    /** Pounds per unit (e.g. Costex), for Miami carrier surcharge. */
    weightPoundsPerUnit?: number;
}

interface OrderBuilderProps {
    items: (SearchResult | OrderItem)[];
    onClose: () => void;
    clientId: number; // Required for orders
    onOrderUpdated?: () => void;
}

export function OrderBuilder({ items, onClose, clientId, onOrderUpdated }: OrderBuilderProps) {
    const { removeItemFromQuote, updateItemQuantity: updateContextQuantity, updateItemPrice: updateContextPrice, currentQuote, clearQuote } = useQuote();

    // Use currentQuote from context if available, otherwise use passed items
    const sourceItems = currentQuote?.items || items;

    const [orderItems, setOrderItems] = useState<OrderItem[]>(
        sourceItems.map(item => {
            // If item already has quantity, unitPrice, totalPrice (it's an OrderItem from context)
            if ('quantity' in item && 'unitPrice' in item && 'totalPrice' in item) {
                const contextItem = item as OrderItem;
                return {
                    ...contextItem,
                    id: contextItem.id || `${contextItem.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    isManual: contextItem.id?.startsWith('manual-') || false,
                    source: contextItem.source || (contextItem.id?.startsWith('third-party-') ? 'third-party' : 'internal'),
                    origin: contextItem.origin, // Preserve origin
                    weightPoundsPerUnit:
                        typeof contextItem.weightPoundsPerUnit === 'number' &&
                        Number.isFinite(contextItem.weightPoundsPerUnit)
                            ? contextItem.weightPoundsPerUnit
                            : undefined,
                };
            }
            // Otherwise it's a SearchResult, convert it
            const searchResult = item as any;
            return {
                id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                reference: item.reference,
                stockQty: item.stockQty,
                basePriceCOP: item.basePriceCOP,
                clientPriceCOP: item.clientPriceCOP,
                hasStock: item.hasStock,
                location: item.location,
                description: item.description,
                quantity: 1,
                unitPrice: item.clientPriceCOP || item.basePriceCOP,
                totalPrice: item.clientPriceCOP || item.basePriceCOP,
                isManual: false,
                source: 'internal',
                origin: searchResult.origin, // Preserve origin if present
                weightPoundsPerUnit:
                    typeof searchResult.weightPoundsPerUnit === 'number' &&
                    Number.isFinite(searchResult.weightPoundsPerUnit)
                        ? searchResult.weightPoundsPerUnit
                        : undefined,
            };
        })
    );

    // Sync local state with context when quote changes
    useEffect(() => {
        if (currentQuote?.items) {
            setOrderItems(currentQuote.items as OrderItem[]);
        } else {
            setOrderItems([]);
        }
    }, [currentQuote?.items]);

    const [isCreating, setIsCreating] = useState(false);
    const [observations, setObservations] = useState<string>('');

    // Order details form (required when creating order)
    const [orderName, setOrderName] = useState('');
    const [dispatchType, setDispatchType] = useState<string>('');
    const [pickupEntity, setPickupEntity] = useState('');
    const [pickupName, setPickupName] = useState('');
    const [carrierName, setCarrierName] = useState('');
    const [carrierAddress, setCarrierAddress] = useState('');
    const [carrierPhone, setCarrierPhone] = useState('');
    const [carrierContactName, setCarrierContactName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('');

    // Client credit (includes external debt; for "Pago con línea de crédito" and order block)
    const [clientCredit, setClientCredit] = useState<{
        hasCredit: boolean;
        creditLimit: number;
        availableCredit: number;
        externalDebt?: number;
        pendingOrdersSum?: number;
        portfolioBlocked?: boolean;
        portfolioBlockMessage?: string | null;
        allowOrdersWithOverduePortfolio?: boolean;
    } | null>(null);

    // Modal: open when user clicks "Crear Orden", form inside modal; on confirm we actually create the order
    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);

    useEffect(() => {
        if (!clientId) {
            setClientCredit(null);
            return;
        }
        let cancelled = false;
        fetch(`/api/users/${clientId}`)
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
                const allowOrdersWithOverduePortfolio = Boolean(
                    u.allowOrdersWithOverduePortfolio
                );
                setClientCredit({
                    hasCredit,
                    creditLimit,
                    availableCredit,
                    externalDebt,
                    pendingOrdersSum,
                    portfolioBlocked,
                    portfolioBlockMessage,
                    allowOrdersWithOverduePortfolio,
                });
            })
            .catch(() => setClientCredit(null));
        return () => { cancelled = true; };
    }, [clientId]);

    const updateQuantity = (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        const item = orderItems.find(i => i.id === itemId);
        if (!item) return;
        const capped = item.hasStock && typeof item.stockQty === 'number'
            ? Math.min(quantity, item.stockQty)
            : quantity;
        const finalQty = Math.max(1, capped);

        setOrderItems(prev => prev.map(i =>
            i.id === itemId
                ? { ...i, quantity: finalQty, totalPrice: i.unitPrice * finalQty }
                : i
        ));

        updateContextQuantity(itemId, finalQty);
    };

    const updatePrice = (itemId: string, newPrice: number) => {
        if (newPrice < 0) return;

        setOrderItems(prev => prev.map(item =>
            item.id === itemId
                ? {
                    ...item,
                    unitPrice: newPrice,
                    basePriceCOP: newPrice,
                    clientPriceCOP: newPrice,
                    totalPrice: newPrice * item.quantity
                }
                : item
        ));

        if (updateContextPrice) {
            updateContextPrice(itemId, newPrice);
        }
    };

    const removeItem = (itemId: string) => {
        setOrderItems(prev => prev.filter(item => item.id !== itemId));
        removeItemFromQuote(itemId);
    };

    const subtotalAmount = orderItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const totalWeightLbs = computeTotalOrderWeightLbs(orderItems);
    const internationalCarrierSurchargeUsd =
        dispatchType === DISPATCH_TYPE_INTERNATIONAL_CARRIER
            ? computeInternationalCarrierSurchargeUsd(totalWeightLbs).feeUsd
            : 0;
    const grandTotalAmount =
        Math.round((subtotalAmount + internationalCarrierSurchargeUsd) * 100) / 100;
    const hasMissingWeightOnSomeLines = orderItems.some(
        (i) =>
            (Number(i.quantity) || 0) > 0 &&
            (typeof i.weightPoundsPerUnit !== 'number' || !Number.isFinite(i.weightPoundsPerUnit))
    );

    const validateOrderDetails = (): boolean => {
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
        return true;
    };

    const canUseCreditLine = Boolean(
        clientCredit?.hasCredit &&
        clientCredit.availableCredit >= grandTotalAmount &&
        grandTotalAmount > 0
    );

    // Block creating any order when client has credit and order total exceeds available credit (debt over limit)
    const isBlockedByCredit = Boolean(
        clientCredit?.hasCredit &&
        grandTotalAmount > 0 &&
        grandTotalAmount > clientCredit.availableCredit
    );

    const isBlockedByPortfolio = Boolean(clientCredit?.portfolioBlocked);

    const openOrderDetailsModal = () => {
        if (orderItems.length === 0) {
            toast.error('No hay ítems en la orden');
            return;
        }
        if (isBlockedByPortfolio) {
            toast.error(
                clientCredit?.portfolioBlockMessage ||
                    'Cartera vencida: el cliente debe regularizar facturas en mora antes de generar órdenes.'
            );
            return;
        }
        setShowOrderDetailsModal(true);
    };

    const handleCreateOrder = async () => {
        if (!validateOrderDetails()) return;
        if (isBlockedByPortfolio) {
            toast.error(
                clientCredit?.portfolioBlockMessage ||
                    'Cartera vencida: no se pueden generar órdenes hasta regularizar la cartera.'
            );
            return;
        }
        if (isBlockedByCredit) {
            toast.error('No puede generar la orden hasta que su cuenta esté por debajo del límite de crédito. Cupo disponible: ' + formatCurrency(clientCredit?.availableCredit ?? 0, 'USD'));
            return;
        }
        if (paymentMethod === PAYMENT_METHOD_CREDIT_LINE && !canUseCreditLine) {
            toast.error(clientCredit?.hasCredit ? 'Cupo de crédito insuficiente' : 'Crédito no disponible para este cliente');
            return;
        }

        const effectiveClientId = clientId || currentQuote?.clientId;
        if (!effectiveClientId) {
            toast.error('Selecciona un cliente antes de crear la orden.');
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: orderItems,
                    clientId: effectiveClientId,
                    clientName: currentQuote?.clientName,
                    clientType: currentQuote?.clientType,
                    totalAmount: grandTotalAmount,
                    observations: observations.trim() || null,
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

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = data?.error || 'No se pudo crear la orden. Inténtelo de nuevo.';
                throw new Error(message);
            }

            if (paymentMethod === PAYMENT_METHOD_STRIPE) {
                const checkoutResponse = await fetch('/api/payments/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        orderId: data.data.id,
                    }),
                });
                const checkoutData = await checkoutResponse.json().catch(() => ({}));
                if (!checkoutResponse.ok || !checkoutData.checkoutUrl) {
                    throw new Error(checkoutData?.error || 'No fue posible iniciar el pago con Stripe.');
                }
                window.location.href = checkoutData.checkoutUrl;
                return;
            }

            const createdOrderId = data.data.id;
            if (paymentMethod === PAYMENT_METHOD_TRANSFER || paymentMethod === PAYMENT_METHOD_ZELLE) {
                toast.success(
                    `Orden #${createdOrderId} registrada. Envíe el comprobante a ${ORDER_PAYMENT_PROOF_EMAIL} con el N.º de orden; se procesa al validar el pago.`,
                    { duration: 7000 }
                );
            } else {
                toast.success(
                    `¡Orden #${createdOrderId} creada exitosamente! Se enviará un correo de confirmación al cliente con el detalle en PDF.`
                );
            }

            // Clear the quote from context and localStorage after successful operation
            clearQuote();

            // Call the callback to refresh the orders page if provided
            if (onOrderUpdated) {
                onOrderUpdated();
            }

            setShowOrderDetailsModal(false);
            onClose();
        } catch (error: any) {
            console.error('Error creating order:', error);
            toast.error(error.message || 'No se pudo crear la orden. Inténtelo de nuevo.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateQuote = async () => {
        if (orderItems.length === 0) {
            toast.error('No hay ítems en la cotización');
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch('/api/quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: orderItems,
                    clientId: clientId,
                    clientName: currentQuote?.clientName,
                    clientType: currentQuote?.clientType,
                    totalAmount: subtotalAmount,
                    observations: observations.trim() || null,
                    createdByClient: true,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create quote');
            }

            toast.success(`¡Cotización #${data.data.id} creada exitosamente!`);
            clearQuote();
            onClose();
            
            // Redirigir a /quotes
            window.location.href = '/quotes';
        } catch (error: any) {
            console.error('Error al crear cotización:', error);
            toast.error(error.message || 'No se pudo crear la cotización');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
        <div className="card h-fit max-h-[calc(100vh-6rem)] flex flex-col">
            <div className="card-header flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Constructor de Orden</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="card-body overflow-y-auto flex-1 min-h-0">
                {orderItems.length === 0 ? (
                    <div className="text-center py-8">
                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ítems seleccionados</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Seleccione ítems de los resultados de búsqueda para crear una orden.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Order Items */}
                        <div className="space-y-3">
                            {orderItems.map((item) => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                                    {/* Full-width block avoids a squeezed grid column in narrow sidebars/modals */}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <h4
                                            className="text-sm font-medium text-gray-900 break-words [overflow-wrap:anywhere]"
                                            title={item.reference}
                                        >
                                            {item.reference}
                                        </h4>
                                        {item.isManual && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Manual
                                            </span>
                                        )}
                                        {!item.hasStock && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                Sin Stock
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 whitespace-normal">
                                        {formatCurrency(item.unitPrice, 'USD')} c/u
                                    </p>
                                    {item.description?.trim() ? (
                                        <p
                                            className="text-xs text-gray-600 leading-relaxed break-words [overflow-wrap:anywhere]"
                                            title={item.description.trim()}
                                        >
                                            {item.description.trim()}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center border border-gray-300 rounded shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={item.quantity <= 1}
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                min={1}
                                                max={item.hasStock && typeof item.stockQty === 'number' ? item.stockQty : undefined}
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                className="w-24 min-w-[5.5rem] text-center border-0 focus:ring-0 text-sm tabular-nums px-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={item.hasStock && typeof item.stockQty === 'number' && item.quantity >= item.stockQty}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right min-w-[4.5rem]">
                                                <div className="text-sm font-medium text-gray-900 whitespace-nowrap tabular-nums">
                                                    {formatCurrency(item.totalPrice, 'USD')}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-400 hover:text-red-600"
                                                title="Eliminar"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stock Status */}
                                    <div>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.hasStock
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {item.hasStock ? 'En Stock' : 'Sin Stock'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Order Summary */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-medium text-gray-900">Subtotal ítems</span>
                                <span className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(subtotalAmount, 'USD')}
                                </span>
                            </div>

                            {/* Order Details */}
                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span>Ítems:</span>
                                    <span>{orderItems.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Observations */}
                        <div className="border-t border-gray-200 pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Observaciones
                            </label>
                            <textarea
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                rows={3}
                                placeholder="Agregar observaciones sobre la orden..."
                            />
                        </div>

                        {isBlockedByPortfolio && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                                {clientCredit?.portfolioBlockMessage ||
                                    'Cartera vencida: el cliente debe poner al día facturas en mora antes de crear órdenes. Ver Crédito y cartera.'}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-4">
                            <div className="flex space-x-3">
                                <button
                                    onClick={openOrderDetailsModal}
                                    disabled={isCreating || orderItems.length === 0 || isBlockedByPortfolio}
                                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="spinner"></div>
                                            <span>Creando...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center space-x-2">
                                            <DocumentTextIcon className="h-4 w-4" />
                                            <span>Crear Orden</span>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={handleCreateQuote}
                                    disabled={isCreating || orderItems.length === 0}
                                    className="flex-1 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    <ClipboardDocumentListIcon className="h-4 w-4" />
                                    <span>Crear Cotización</span>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    clearQuote();
                                    toast.success('Carrito limpiado');
                                }}
                                className="w-full btn-secondary flex items-center justify-center space-x-2"
                                disabled={isCreating}
                            >
                                <TrashIcon className="h-4 w-4" />
                                <span>Limpiar</span>
                            </button>

                            <div className="flex justify-center">
                                <button
                                    onClick={onClose}
                                    className="btn-secondary px-8"
                                    disabled={isCreating}
                                >
                                    Ocultar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Modal: order details form — shown after clicking "Crear Orden", before actually creating */}
        {showOrderDetailsModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50" onClick={() => !isCreating && setShowOrderDetailsModal(false)} aria-hidden />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Detalles de la orden</h3>
                            <button
                                type="button"
                                onClick={() => !isCreating && setShowOrderDetailsModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Complete nombre, despacho y pago para crear la orden.</p>

                        <div className="space-y-4">
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
                                        totalWeightLbs={totalWeightLbs}
                                        surchargeFeeUsd={internationalCarrierSurchargeUsd}
                                        lineSubtotalUsd={subtotalAmount}
                                        grandTotalUsd={grandTotalAmount}
                                        hasMissingWeightOnSomeLines={hasMissingWeightOnSomeLines}
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
                                        {clientCredit?.hasCredit && !canUseCreditLine && grandTotalAmount > 0 && ' (Cupo insuficiente)'}
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
                                    <StripeFeeNotice orderTotalUsd={grandTotalAmount} variant="create-order" />
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

                        {isBlockedByPortfolio && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                                {clientCredit?.portfolioBlockMessage ||
                                    'Cartera vencida: no se pueden generar órdenes hasta regularizar la cartera.'}
                            </div>
                        )}

                        {isBlockedByCredit && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                                No puede generar la orden hasta que su cuenta o deuda general esté por debajo del límite de crédito. Cupo disponible: {formatCurrency(clientCredit?.availableCredit ?? 0, 'USD')}.
                            </div>
                        )}

                        <div className="mt-6 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowOrderDetailsModal(false)}
                                disabled={isCreating}
                                className="btn-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreateOrder()}
                                disabled={
                                    isCreating ||
                                    isBlockedByPortfolio ||
                                    isBlockedByCredit ||
                                    (paymentMethod === PAYMENT_METHOD_CREDIT_LINE && !canUseCreditLine)
                                }
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                            >
                                {isCreating ? (
                                    <>
                                        <div className="spinner"></div>
                                        <span>Creando...</span>
                                    </>
                                ) : (
                                    <>
                                        <DocumentTextIcon className="h-4 w-4" />
                                        <span>Confirmar y crear orden</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}









