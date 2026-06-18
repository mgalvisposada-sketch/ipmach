'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, XMarkIcon, PlusIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
}

interface SearchResultsProps {
    results: SearchResult[];
    selectedItems: Set<string>;
    onItemToggle: (reference: string) => void;
    onAddToQuote: (result: SearchResult) => void;
    onAddThirdPartySource?: (reference: string, price: number, sourceName: string, location?: string, stock?: number, description?: string) => void;
    clientId?: number;
}

export function SearchResults({ results, selectedItems, onItemToggle, onAddToQuote, onAddThirdPartySource, clientId }: SearchResultsProps) {
    const [showThirdPartyForm, setShowThirdPartyForm] = useState<string | null>(null);
    const [thirdPartyPrice, setThirdPartyPrice] = useState<number>(0);
    const [thirdPartySource, setThirdPartySource] = useState<string>('');
    const [thirdPartyDescription, setThirdPartyDescription] = useState<string>('');

    // Per-reference warehouse stock strings cache: REF -> formatted string
    const [referenceStockInfo, setReferenceStockInfo] = useState<Record<string, string>>({});
    const inFlightRefs = useRef<Set<string>>(new Set());

    const references = useMemo(() => results.map(r => r.reference), [results]);

    useEffect(() => {
        // Fetch stock info for any new references not yet cached or in flight
        references.forEach((ref) => {
            if (!ref || referenceStockInfo[ref] || inFlightRefs.current.has(ref)) return;
            inFlightRefs.current.add(ref);

            const controller = new AbortController();
            const fetchInfo = async () => {
                try {
                    const res = await fetch('/api/search', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ reference: ref }),
                        signal: controller.signal,
                    });
                    const data = await res.json().catch(() => ({}));

                    // Try to normalize response - look for warehouse/stock data in the search results
                    const results = Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

                    // Extract warehouse information from search results
                    const warehouseInfo: Array<{ name?: string; stock?: number; qty?: number }> = [];

                    // Look for warehouse data in the results
                    results.forEach((result: any) => {
                        if (result.reference === ref) {
                            // Check if result has warehouse/stock information
                            if (result.warehouses && Array.isArray(result.warehouses)) {
                                warehouseInfo.push(...result.warehouses);
                            } else if (result.stockQty !== undefined) {
                                // Use the stock quantity from the result
                                warehouseInfo.push({ name: 'Stock', stock: result.stockQty });
                            }
                        }
                    });

                    const parts: string[] = [];
                    warehouseInfo.forEach((w, idx) => {
                        const name = (w?.name || `Bodega ${idx + 1}`).toString();
                        const qty = Number(typeof w?.stock === 'number' ? w.stock : (typeof w?.qty === 'number' ? w.qty : 0));
                        parts.push(`${name}: ${Number.isFinite(qty) ? qty : 0}`);
                    });

                    const info = parts.length > 0 ? parts.join(', ') : 'Sin datos de bodega';
                    setReferenceStockInfo(prev => ({ ...prev, [ref]: info }));
                } catch (_) {
                    setReferenceStockInfo(prev => ({ ...prev, [ref]: 'Sin datos de bodega' }));
                } finally {
                    inFlightRefs.current.delete(ref);
                }
            };

            fetchInfo();
            return () => controller.abort();
        });
    }, [references, referenceStockInfo]);

    if (results.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">No search results to display.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {results.map((result, index) => {
                const isSelected = selectedItems.has(result.reference);
                const displayPrice = clientId && result.clientPriceCOP
                    ? result.clientPriceCOP
                    : result.basePriceCOP;

                return (
                    <div
                        key={`${result.reference}-${index}`}
                        className={`border rounded-lg p-4 transition-all duration-200 ${isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-start space-x-4">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 pt-1">
                                <button
                                    onClick={() => onItemToggle(result.reference)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-200 ${isSelected
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-gray-300 hover:border-blue-400'
                                        }`}
                                >
                                    {isSelected && <CheckIcon className="h-3 w-3" />}
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {result.reference}
                                            </h3>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Interno
                                            </span>
                                            {result.hasStock && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    ✓ En Stock
                                                </span>
                                            )}
                                        </div>
                                        {result.description && (
                                            <p className="mt-1 text-sm text-gray-600">
                                                {result.description}
                                            </p>
                                        )}
                                        {referenceStockInfo[result.reference] && (
                                            <p className="mt-1 text-xs text-gray-500 truncate">
                                                {`${result.reference} - ${formatCurrency(displayPrice)} - ${referenceStockInfo[result.reference]}`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Price */}
                                    <div className="text-right ml-4">
                                        <div className="text-lg font-semibold text-gray-900">
                                            {formatCurrency(displayPrice)}
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-gray-500">Stock:</span>
                                        <span className={`font-medium ${result.hasStock ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {result.hasStock ? `${result.stockQty} unidades` : 'Sin stock'}
                                        </span>
                                        {result.hasStock ? (
                                            <CheckIcon className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <XMarkIcon className="h-4 w-4 text-red-500" />
                                        )}
                                    </div>

                                    {result.location && (
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500">Ubicación:</span>
                                            <span className="font-medium text-gray-900">{result.location}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Client Price Indicator */}
                                {clientId && result.clientPriceCOP && (
                                    <div className="mt-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Precio de Cliente Aplicado
                                        </span>
                                    </div>
                                )}

                                {/* Add to Quote Button */}
                                <div className="mt-3">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            console.log('Add to quote button clicked for:', result.reference);
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onAddToQuote(result);
                                        }}
                                        className={`w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${result.hasStock
                                            ? 'border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500'
                                            : 'border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 focus:ring-orange-500'
                                            }`}
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        <span>
                                            {result.hasStock
                                                ? 'Agregar a Cotización'
                                                : 'Agregar (Sin Stock)'
                                            }
                                        </span>
                                    </button>
                                </div>

                                {/* Third Party Source Option */}
                                {onAddThirdPartySource && (
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowThirdPartyForm(showThirdPartyForm === result.reference ? null : result.reference);
                                                setThirdPartyPrice(0);
                                                setThirdPartySource('');
                                                setThirdPartyDescription(result.description || '');
                                            }}
                                            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                                        >
                                            <BuildingOfficeIcon className="h-4 w-4" />
                                            <span>Agregar de Proveedor Externo</span>
                                        </button>

                                        {showThirdPartyForm === result.reference && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Precio (COP)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={thirdPartyPrice}
                                                            onChange={(e) => setThirdPartyPrice(Number(e.target.value) || 0)}
                                                            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                                                            placeholder="0.00"
                                                            min="0"
                                                            step="0.01"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Descripción (opcional)
                                                        </label>
                                                        <textarea
                                                            value={thirdPartyDescription}
                                                            onChange={(e) => setThirdPartyDescription(e.target.value)}
                                                            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                                                            placeholder="Descripción del producto"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (thirdPartyPrice > 0) {
                                                                    const providerName = thirdPartySource.trim() || 'Proveedor Externo';
                                                                    onAddThirdPartySource(
                                                                        result.reference,
                                                                        thirdPartyPrice,
                                                                        providerName,
                                                                        undefined, // location
                                                                        undefined, // stock
                                                                        thirdPartyDescription.trim() || undefined // description
                                                                    );
                                                                    setShowThirdPartyForm(null);
                                                                    setThirdPartyPrice(0);
                                                                    setThirdPartySource('');
                                                                    setThirdPartyDescription('');
                                                                }
                                                            }}
                                                            disabled={thirdPartyPrice <= 0}
                                                            className="flex-1 px-3 py-1 text-xs font-medium rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Agregar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowThirdPartyForm(null);
                                                                setThirdPartyPrice(0);
                                                                setThirdPartySource('');
                                                                setThirdPartyDescription('');
                                                            }}
                                                            className="px-3 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
