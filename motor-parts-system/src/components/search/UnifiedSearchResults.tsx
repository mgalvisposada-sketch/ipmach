'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ProductCard } from './ProductCard';
import { toast } from 'react-hot-toast';

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
}

interface ExternalResult {
    source: string;
    data: any;
}

interface UnifiedResult {
    id: string;
    reference: string;
    stockQty: number;
    priceCOP: number;
    /** When USD (e.g. Costex), display and use this amount as price in USD */
    priceCurrency?: 'USD' | 'COP';
    /** Raw cost before profit (e.g. Costex baseCostUSD). Used for order integration. */
    costUSD?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    source: 'internal' | 'external';
    sourceName: string;
    imageUrl?: string;
    weight?: {
        pounds: number;
        kilograms: number;
    };
    category?: {
        major: string;
        category: string;
        subCategory: string;
        minor: string;
    };
}

interface UnifiedSearchResultsProps {
    internalResults: SearchResult[];
    externalResults: ExternalResult[];
    onAddToQuote: (result: SearchResult, quantity: number, shouldClearResults?: boolean) => void;
    onAddThirdPartySource: (
        reference: string,
        price: number,
        sourceName: string,
        location?: string,
        stock?: number,
        description?: string,
        origin?: string,
        brand?: string,
        quantity?: number,
        shouldClearResults?: boolean,
        baseCost?: number,
        weightPoundsPerUnit?: number
    ) => void;
    onClearResults?: () => void;
    clientId?: number;
    userRole?: string;
    context?: 'quote' | 'order'; // Context for button text (default: 'quote')
}

export function UnifiedSearchResults({
    internalResults,
    externalResults,
    onAddToQuote,
    onAddThirdPartySource,
    onClearResults,
    clientId,
    userRole,
    context = 'quote'
}: UnifiedSearchResultsProps) {
    const [showThirdPartyForm, setShowThirdPartyForm] = useState<{ isOpen: boolean; result: UnifiedResult | null }>({
        isOpen: false,
        result: null
    });
    const [thirdPartyPrice, setThirdPartyPrice] = useState<number>(0);
    const [thirdPartySource, setThirdPartySource] = useState<string>('');
    const [thirdPartyDescription, setThirdPartyDescription] = useState<string>('');
    const [thirdPartyBrand, setThirdPartyBrand] = useState<string>('');
    const [showImageModal, setShowImageModal] = useState<{ isOpen: boolean; imageUrl: string; reference: string }>({
        isOpen: false,
        imageUrl: '',
        reference: ''
    });

    // Convert internal results to unified format
    const internalUnified: UnifiedResult[] = internalResults.map((result, index) => ({
        id: `internal-${index}`,
        reference: result.reference,
        stockQty: result.stockQty,
        priceCOP: clientId && result.clientPriceCOP ? result.clientPriceCOP : result.basePriceCOP,
        hasStock: result.hasStock,
        location: result.location,
        description: result.description,
        source: 'internal' as const,
        sourceName: 'Interno'
    }));

    // Convert external results to unified format (Costex: use minPriceUSD for sell price; baseCostUSD for cost)
    const externalUnified: UnifiedResult[] = externalResults.map((external, index) => {
        const data = external.data;
        const hasStock = data.totalStock > 0;
        const isCostexUSD = data.minPriceUSD != null && data.minPriceUSD > 0;
        const displayPrice = isCostexUSD
            ? data.minPriceUSD
            : (data.minPriceCOP > 0 ? data.minPriceCOP : data.listPriceCOP ?? 0);
        const priceCurrency: 'USD' | 'COP' = isCostexUSD ? 'USD' : 'COP';
        const costUSD = data.baseCostUSD ?? data.calculation?.inputs?.baseCostUSD;

        return {
            id: `external-${index}`,
            reference: data.partNumber,
            stockQty: data.totalStock,
            priceCOP: displayPrice,
            priceCurrency,
            costUSD: typeof costUSD === 'number' && Number.isFinite(costUSD) ? costUSD : undefined,
            hasStock,
            location: data.locations && Object.keys(data.locations).length > 0
                ? Object.values(data.locations).map((loc: any) => `${loc.BranchName?.trim() || 'Location'}`).join(', ')
                : undefined,
            description: data.description,
            source: 'external' as const,
            sourceName: 'Costex',
            imageUrl: data.imageUrl,
            weight: data.weight,
            category: data.category
        };
    });

    // Combine and sort all results by stock quantity (descending)
    const allResults = [...internalUnified, ...externalUnified].sort((a, b) => {
        // Both have stock - sort by stock quantity (descending)
        if (a.hasStock && b.hasStock) {
            return b.stockQty - a.stockQty;
        }
        // Only a has stock - a comes first
        if (a.hasStock && !b.hasStock) {
            return -1;
        }
        // Only b has stock - b comes first
        if (!a.hasStock && b.hasStock) {
            return 1;
        }
        // Neither has stock - sort by reference
        return a.reference.localeCompare(b.reference);
    });

    if (allResults.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No se encontraron resultados.</p>
            </div>
        );
    }

    return (
        <div>
            {onClearResults && allResults.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => onClearResults()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <XMarkIcon className="h-4 w-4 shrink-0" aria-hidden />
                        Limpiar resultados
                    </button>
                </div>
            )}
            {/* Product List */}
            <div className="space-y-4">
                {allResults.map((result) => {
                    const handleAddProduct = (quantity: number) => {
                        if (result.source === 'internal') {
                            // For internal products, use onAddToQuote with the SearchResult format
                            const searchResult: SearchResult = {
                                reference: result.reference,
                                stockQty: result.stockQty,
                                basePriceCOP: result.priceCOP,
                                clientPriceCOP: clientId ? result.priceCOP : undefined,
                                hasStock: result.hasStock,
                                location: result.location,
                                description: result.description,
                            };
                            
                            // Pasar la cantidad directamente, sin loop
                            onAddToQuote(searchResult, quantity, false);
                            
                            toast.success(`${quantity} unidad(es) de ${result.reference} agregadas`);
                        } else {
                            // Para productos externos (Costex): price = sell price, baseCost = raw cost for order integration
                            onAddThirdPartySource(
                                result.reference,
                                result.priceCOP,
                                'Costex',
                                result.location,
                                result.stockQty,
                                result.description,
                                undefined, // origin
                                undefined, // brand
                                quantity, // Agregar parametro de cantidad
                                false, // don't clear results
                                result.costUSD, // raw cost (e.g. Costex baseCostUSD)
                                typeof result.weight?.pounds === 'number' && Number.isFinite(result.weight.pounds)
                                    ? result.weight.pounds
                                    : undefined
                            );
                            toast.success(`${quantity} unidad(es) de ${result.reference} agregadas`);
                        }
                        
                        // Clear search results after adding
                        if (onClearResults) {
                            onClearResults();
                        }
                    };

                    // Edit before add - only for admins/agents on external products
                    const handleEditBeforeAdd = () => {
                        setShowThirdPartyForm({ isOpen: true, result });
                        setThirdPartyPrice(result.priceCOP);
                        setThirdPartySource('Costex');
                        setThirdPartyDescription(result.description || '');
                        setThirdPartyBrand('');
                    };

                    return (
                        <ProductCard
                            key={result.id}
                            reference={result.reference}
                            description={result.description}
                            stockQty={result.stockQty}
                            hasStock={result.hasStock}
                            priceCOP={result.priceCOP}
                            priceCurrency={result.priceCurrency}
                            location={result.location}
                            source={result.source}
                            sourceName={result.sourceName}
                            imageUrl={result.imageUrl}
                            weight={result.weight}
                            category={result.category}
                            onAddToQuote={handleAddProduct}
                            onImageClick={() => {
                                if (result.imageUrl) {
                                    setShowImageModal({
                                        isOpen: true,
                                        imageUrl: result.imageUrl,
                                        reference: result.reference
                                    });
                                }
                            }}
                            showSource={userRole !== 'client'}
                            onEditBeforeAdd={userRole !== 'client' && result.source === 'external' ? handleEditBeforeAdd : undefined}
                            showEditButton={userRole !== 'client' && result.source === 'external'}
                            context={context}
                        />
                    );
                })}
            </div>

            {/* Third Party Form Modal */}
            {showThirdPartyForm.isOpen && showThirdPartyForm.result && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Editar Producto Antes de Agregar
                            </h3>
                            <p className="text-sm text-gray-600 mb-4">
                                Personaliza el precio, proveedor y marca antes de agregarlo a la cotización
                            </p>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Referencia
                                    </label>
                                    <input
                                        type="text"
                                        value={showThirdPartyForm.result.reference}
                                        disabled
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Precio
                                    </label>
                                    <input
                                        type="number"
                                        value={thirdPartyPrice}
                                        onChange={(e) => setThirdPartyPrice(Number(e.target.value) || 0)}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Proveedor
                                    </label>
                                    <input
                                        type="text"
                                        value={thirdPartySource}
                                        onChange={(e) => setThirdPartySource(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                        placeholder="Nombre del proveedor"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Marca
                                    </label>
                                    <input
                                        type="text"
                                        value={thirdPartyBrand}
                                        onChange={(e) => setThirdPartyBrand(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                        placeholder="Ej: Caterpillar, John Deere, etc. (opcional)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={thirdPartyDescription}
                                        onChange={(e) => setThirdPartyDescription(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                                        placeholder="Descripción del producto (opcional)"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex space-x-3 pt-4">
                                    <button
                                        onClick={() => {
                                            if (thirdPartyPrice > 0 && showThirdPartyForm.result) {
                                                onAddThirdPartySource(
                                                    showThirdPartyForm.result.reference,
                                                    thirdPartyPrice,
                                                    thirdPartySource.trim() || 'Proveedor Externo',
                                                    showThirdPartyForm.result.location,
                                                    showThirdPartyForm.result.stockQty,
                                                    thirdPartyDescription.trim() || undefined,
                                                    undefined, // origin
                                                    thirdPartyBrand.trim() || undefined,
                                                    1, // quantity
                                                    true, // shouldClearResults
                                                    showThirdPartyForm.result.costUSD, // baseCost for order integration
                                                    typeof showThirdPartyForm.result.weight?.pounds === 'number' &&
                                                    Number.isFinite(showThirdPartyForm.result.weight.pounds)
                                                        ? showThirdPartyForm.result.weight.pounds
                                                        : undefined
                                                );
                                                setShowThirdPartyForm({ isOpen: false, result: null });
                                                setThirdPartyPrice(0);
                                                setThirdPartySource('');
                                                setThirdPartyDescription('');
                                                setThirdPartyBrand('');
                                            }
                                        }}
                                        disabled={thirdPartyPrice <= 0}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Agregar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowThirdPartyForm({ isOpen: false, result: null });
                                            setThirdPartyPrice(0);
                                            setThirdPartySource('');
                                            setThirdPartyDescription('');
                                            setThirdPartyBrand('');
                                        }}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {showImageModal.isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={() => setShowImageModal({ isOpen: false, imageUrl: '', reference: '' })}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">
                                Imagen - {showImageModal.reference}
                            </h3>
                            <button
                                onClick={() => setShowImageModal({ isOpen: false, imageUrl: '', reference: '' })}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4">
                            <div className="flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={showImageModal.imageUrl}
                                    alt={showImageModal.reference}
                                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                                    onError={(e) => {
                                        e.currentTarget.src = '/placeholder-image.png';
                                        e.currentTarget.alt = 'Imagen no disponible';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end p-4 border-t border-gray-200">
                            <button
                                onClick={() => setShowImageModal({ isOpen: false, imageUrl: '', reference: '' })}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
