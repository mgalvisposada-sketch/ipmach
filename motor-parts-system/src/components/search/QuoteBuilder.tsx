'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { XMarkIcon, DocumentTextIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatCurrency, roundMoney2 } from '@/lib/utils';
import { useQuote } from '@/contexts/QuoteContext';

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
}

interface QuoteItem {
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
    isManual?: boolean; // Flag to identify manually added references
    source?: 'internal' | 'third-party'; // Source of the item
    sourceName?: string; // Name of the third-party provider
    brand?: string; // Brand name for external references
}

interface QuoteBuilderProps {
    items: (SearchResult | QuoteItem)[];
    onClose: () => void;
    agentId: number;
    clientId?: number;
    isEditing?: boolean;
    editingQuoteId?: string;
    onQuoteUpdated?: () => void;
    userRole?: string;
}

export function QuoteBuilder({ items, onClose, agentId, clientId, isEditing = false, editingQuoteId, onQuoteUpdated, userRole }: QuoteBuilderProps) {
    const { removeItemFromQuote, updateItemQuantity: updateContextQuantity, updateItemPrice: updateContextPrice, currentQuote, clearQuote } = useQuote();
    console.log('QuoteBuilder received items:', items);
    console.log('QuoteBuilder current quote from context:', currentQuote);

    // Use currentQuote from context if available, otherwise use passed items
    const sourceItems = currentQuote?.items || items;

    const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(
        sourceItems.map(item => {
            console.log('Processing item:', item);
            // If item already has quantity, unitPrice, totalPrice (it's a QuoteItem from context)
            if ('quantity' in item && 'unitPrice' in item && 'totalPrice' in item) {
                console.log('Item is QuoteItem from context:', item);
                const contextItem = item as QuoteItem;
                // Ensure the item has an id, generate one if missing
                return {
                    ...contextItem,
                    id: contextItem.id || `${contextItem.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    isManual: contextItem.id?.startsWith('manual-') || false,
                    source: contextItem.source || (contextItem.id?.startsWith('third-party-') ? 'third-party' : 'internal')
                };
            }
            // Otherwise it's a SearchResult, convert it
            console.log('Item is SearchResult, converting:', item);
            const unit = roundMoney2(
                Number(clientId && item.clientPriceCOP ? item.clientPriceCOP : item.basePriceCOP)
            );
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
                unitPrice: unit,
                totalPrice: roundMoney2(unit),
                isManual: false,
                source: 'internal'
            };
        })
    );

    console.log('QuoteBuilder initialized with quoteItems:', quoteItems);

    // Sync local state with context when quote changes
    useEffect(() => {
        if (currentQuote?.items) {
            console.log('Syncing QuoteBuilder with updated context quote:', currentQuote.items);
            setQuoteItems(currentQuote.items);
        } else {
            // When the quote is cleared in context, also clear local state
            console.log('Context quote cleared, resetting local quoteItems');
            setQuoteItems([]);
        }
    }, [currentQuote?.items]);

    const [isCreating, setIsCreating] = useState(false);
    const [observations, setObservations] = useState<string>('');

    const updateQuantity = (itemId: string, quantity: number) => {
        if (quantity < 1) return;

        // Update local state for immediate UI feedback
        setQuoteItems(prev => prev.map(item =>
            item.id === itemId
                ? { ...item, quantity, totalPrice: roundMoney2(item.unitPrice * quantity) }
                : item
        ));

        // Update the persistent quote in context
        updateContextQuantity(itemId, quantity);
    };

    const updatePrice = (itemId: string, newPrice: number) => {
        if (newPrice < 0) return;

        // Update local state for immediate UI feedback
        setQuoteItems(prev => prev.map(item =>
            item.id === itemId
                ? {
                    ...item,
                    unitPrice: roundMoney2(newPrice),
                    basePriceCOP: roundMoney2(newPrice),
                    clientPriceCOP: clientId ? roundMoney2(newPrice) : undefined,
                    totalPrice: roundMoney2(newPrice * item.quantity)
                }
                : item
        ));

        // Update the persistent quote in context
        if (updateContextPrice) {
            updateContextPrice(itemId, newPrice);
        }
    };

    const removeItem = (itemId: string) => {
        // Update local state for immediate UI feedback
        setQuoteItems(prev => prev.filter(item => item.id !== itemId));

        // Remove from persistent quote in context
        removeItemFromQuote(itemId);
    };

    const totalAmount = roundMoney2(
        quoteItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    );

    const handleCreateOrUpdateQuote = async () => {
        if (quoteItems.length === 0) {
            toast.error('No hay ítems en la cotización');
            return;
        }

        setIsCreating(true);
        try {
            const isEditMode = isEditing && editingQuoteId;
            const url = isEditMode ? `/api/quotes/${editingQuoteId}` : '/api/quotes';
            const method = isEditMode ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: quoteItems,
                    clientId: currentQuote?.clientId || clientId,
                    clientName: currentQuote?.clientName,
                    clientType: currentQuote?.clientType,
                    totalAmount: totalAmount,
                    observations: observations.trim() || null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} quote`);
            }

            const action = isEditMode ? 'actualizada' : 'creada';
            toast.success(`¡Cotización #${data.data.id} ${action} exitosamente!`);

            // Clear the quote from context and localStorage after successful operation
            clearQuote();

            // Call the callback to refresh the quotes page if provided
            if (onQuoteUpdated) {
                onQuoteUpdated();
            }

            onClose();
        } catch (error: any) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} quote:`, error);
            const action = isEditing ? 'actualizar' : 'crear';
            toast.error(error.message || `No se pudo ${action} la cotización. Inténtelo de nuevo.`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="card h-fit">
            <div className="card-header">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Constructor de Cotización</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="card-body">
                {quoteItems.length === 0 ? (
                    <div className="text-center py-8">
                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ítems seleccionados</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Seleccione ítems de los resultados de búsqueda para crear una cotización.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Quote Items */}
                        <div className="space-y-3">
                            {quoteItems.map((item) => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <h4
                                            className="text-sm font-medium text-gray-900 break-words [overflow-wrap:anywhere]"
                                            title={item.reference}
                                        >
                                            {item.reference}
                                        </h4>
                                        {item.brand && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                {item.brand}
                                            </span>
                                        )}
                                        {item.isManual && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Manual
                                            </span>
                                        )}
                                        {item.source === 'third-party' && userRole !== 'client' && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                {item.sourceName || 'Proveedor Externo'}
                                            </span>
                                        )}
                                        {!item.hasStock && (
                                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                Sin Stock
                                            </span>
                                        )}
                                    </div>
                                    {(item.isManual || item.source === 'third-party') ? (
                                        <div>
                                            <label className="text-xs text-gray-500">Precio (USD):</label>
                                            {userRole === 'client' ? (
                                                <p className="text-xs text-gray-700 mt-1 font-medium">{formatCurrency(item.unitPrice, 'USD')}</p>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updatePrice(item.id, Number(e.target.value) || 0)}
                                                    className="w-full max-w-32 text-xs border border-gray-300 rounded px-2 py-1 mt-1"
                                                    min="0"
                                                    step="0.01"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 whitespace-normal">
                                            {formatCurrency(item.unitPrice, 'USD')} c/u
                                        </p>
                                    )}
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
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                                                disabled={item.quantity <= 1}
                                            >
                                                -
                                            </button>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                className="w-24 min-w-[5.5rem] text-center border-0 focus:ring-0 text-sm tabular-nums px-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-100"
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

                        {/* Quote Summary */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-lg font-medium text-gray-900">Total</span>
                                <span className="text-2xl font-bold text-gray-900">
                                    {formatCurrency(totalAmount, 'USD')}
                                </span>
                            </div>

                            {/* Quote Details */}
                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span>Ítems:</span>
                                    <span>{quoteItems.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Agente:</span>
                                    <span>ID: {agentId}</span>
                                </div>
                                {(clientId || currentQuote?.clientId) && (
                                    <div className="flex justify-between">
                                        <span>Cliente:</span>
                                        <span>
                                            {currentQuote?.clientName || `ID: ${clientId || currentQuote?.clientId}`}
                                            {currentQuote?.clientType && ` (Tipo ${currentQuote.clientType})`}
                                        </span>
                                    </div>
                                )}
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
                                placeholder="Agregar observaciones sobre la cotización..."
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-4">
                            {/* Top Row - Two buttons side by side */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleCreateOrUpdateQuote}
                                    disabled={isCreating || quoteItems.length === 0}
                                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isCreating ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="spinner"></div>
                                            <span>{isEditing ? 'Actualizando...' : 'Creando...'}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center space-x-2">
                                            <DocumentTextIcon className="h-4 w-4" />
                                            <span>{isEditing ? 'Actualizar Cotización' : 'Crear Cotización'}</span>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        clearQuote();
                                        toast.success('Cotización limpiada');
                                    }}
                                    className="flex-1 btn-secondary flex items-center justify-center space-x-2"
                                    disabled={isCreating}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    <span>Limpiar</span>
                                </button>
                            </div>

                            {/* Bottom Row - Single button centered */}
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
    );
}
