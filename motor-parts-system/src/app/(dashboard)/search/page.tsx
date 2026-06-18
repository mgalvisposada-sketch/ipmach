'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { MagnifyingGlassIcon, DocumentTextIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { SearchForm } from '@/components/forms/SearchForm';
import { SearchResults } from '@/components/search/SearchResults';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { ProductCard } from '@/components/search/ProductCard';
import { QuoteBuilder } from '@/components/search/QuoteBuilder';
import { OrderBuilder } from '@/components/search/OrderBuilder';
import ExcelUploader from '@/components/search/ExcelUploader';
import BatchResultsModal from '@/components/search/BatchResultsModal';
import { useQuote } from '@/contexts/QuoteContext';
import { formatCurrency, formatCurrencyWithSymbol, convertUSDToCOP } from '@/lib/utils';

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    origin?: string;
    weightPoundsPerUnit?: number;
}

interface ExternalResult {
    source: string;
    data: any;
}

/** Client type A (tipo A) when no client is selected for admin search */
const DEFAULT_CLIENT_TYPE_NO_CLIENT = 17;

/** Round to 2 decimal places for display and quote values */
function roundPrice(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Sort search results by stock availability with non-Costex priority
 * Priority order:
 * 1. Internal results with stock (highest stock first)
 * 2. Internal results without stock
 * 3. External (Costex) results with stock (highest stock first)
 * 4. External (Costex) results without stock
 */
function sortResultsByStockAvailability(internalResults: SearchResult[], externalResults: ExternalResult[]) {
    // Sort internal results: stock available first (by quantity desc), then no stock
    const sortedInternal = [...internalResults].sort((a, b) => {
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
        // Neither has stock - maintain original order
        return 0;
    });

    // Sort external results: stock available first (by quantity desc), then no stock
    const sortedExternal = [...externalResults].sort((a, b) => {
        const aHasStock = a.data.totalStock > 0;
        const bHasStock = b.data.totalStock > 0;
        const aStock = a.data.totalStock || 0;
        const bStock = b.data.totalStock || 0;

        // Both have stock - sort by stock quantity (descending)
        if (aHasStock && bHasStock) {
            return bStock - aStock;
        }
        // Only a has stock - a comes first
        if (aHasStock && !bHasStock) {
            return -1;
        }
        // Only b has stock - b comes first
        if (!aHasStock && bHasStock) {
            return 1;
        }
        // Neither has stock - maintain original order
        return 0;
    });

    return {
        internal: sortedInternal,
        external: sortedExternal
    };
}

export const dynamic = 'force-dynamic';

// Deep Web Form Modal Component
function DeepWebFormModal({ result, originName, onAdd, onCancel }: { result: SearchResult; originName: string; onAdd: (brand?: string) => void; onCancel: () => void }) {
    const [brand, setBrand] = useState<string>('');

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referencia
                </label>
                <input
                    type="text"
                    value={result.reference}
                    disabled
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-gray-50"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio (COP)
                </label>
                <input
                    type="number"
                    value={result.basePriceCOP}
                    disabled
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-gray-50"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor
                </label>
                <input
                    type="text"
                    value={originName}
                    disabled
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 bg-gray-50"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                </label>
                <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-3 py-2"
                    placeholder="Ej: Caterpillar, John Deere, etc. (opcional)"
                />
            </div>
            <div className="flex space-x-3 pt-4">
                <button
                    onClick={() => onAdd(brand.trim() || undefined)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Agregar
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export default function SearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { addItemToQuote, currentQuote, getQuoteItemCount, quoteMode, getEditingQuoteId } = useQuote();
    
    // Search mode: 'single' for individual search, 'batch' for Excel upload
    const [searchMode, setSearchMode] = useState<'single' | 'batch'>('single');
    
    // Batch search states
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchResults, setBatchResults] = useState<any>(null);
    const [showBatchModal, setShowBatchModal] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [externalResults, setExternalResults] = useState<ExternalResult[]>([]);
    const [deepWebResults, setDeepWebResults] = useState<SearchResult[]>([]);
    const [deepWebResultsByOrigin, setDeepWebResultsByOrigin] = useState<Map<string, SearchResult[]>>(new Map());
    const [deepWebOrigins, setDeepWebOrigins] = useState<Array<{ originCode: string; originName: string; productCount: number }>>([]);
    const [deepWebErrors, setDeepWebErrors] = useState<Map<string, string>>(new Map()); // Map of originCode -> error message
    const resultReceiverOrderRef = useRef<string[]>([]); // Track order in which results are received (using ref for synchronous access)
    const [selectedOriginTab, setSelectedOriginTab] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);
    const [isDeepWebSearching, setIsDeepWebSearching] = useState(false);
    const [deepWebSearchingSources, setDeepWebSearchingSources] = useState<Array<{ originCode: string; originName: string }>>([]);
    const [clientId, setClientId] = useState<number | undefined>();
    const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
    const [clientType, setClientType] = useState<number | undefined>();
    const [showDeepWebForm, setShowDeepWebForm] = useState<{ isOpen: boolean; result: SearchResult | null; originName: string }>({ isOpen: false, result: null, originName: '' });

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Auto-open the builder when a quote is present (e.g., loaded from localStorage via "Ver")
    useEffect(() => {
        if (currentQuote && currentQuote.items && currentQuote.items.length > 0) {
            setShowQuoteBuilder(true);
        }
    }, [currentQuote]);

    // Keep clientId in sync with quote when quote has a client (e.g. admin selected client then added items without searching)
    useEffect(() => {
        if (currentQuote?.clientId && (clientId === undefined || clientId !== currentQuote.clientId)) {
            setClientId(currentQuote.clientId);
            if (currentQuote.clientType != null) setClientType(currentQuote.clientType);
        }
    }, [currentQuote?.clientId, currentQuote?.clientType]);

    // Cleanup on unmount (for any potential intervals)
    useEffect(() => {
        return () => {
            if ((window as any).deepWebPollInterval) {
                clearInterval((window as any).deepWebPollInterval);
                (window as any).deepWebPollInterval = null;
            }
        };
    }, []);

    const handleSearch = async (term: string, clientIdOptional?: number, hintedPrice?: number, clientTypeOptional?: number, likeSearch?: boolean) => {
        if (!term.trim()) {
            toast.error('Por favor ingrese un término de búsqueda');
            return;
        }

        setIsSearching(true);
        setSearchTerm(term);
        setClientId(clientIdOptional);
        setClientType(clientTypeOptional);
        // Clear all deep web state when doing regular search
        setDeepWebResults([]);
        setDeepWebResultsByOrigin(new Map());
        setDeepWebOrigins([]);
        setDeepWebErrors(new Map());
        setSelectedOriginTab(''); // Reset selected tab

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference: term, clientId: clientIdOptional, clientType: clientTypeOptional ?? DEFAULT_CLIENT_TYPE_NO_CLIENT, likeSearch }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'La búsqueda falló');
            }

            const results: SearchResult[] = (data.data || []).map((r: any) => {
                const base = typeof hintedPrice === 'number' ? hintedPrice : (r.basePriceCOP || 0);
                return {
                    ...r,
                    basePriceCOP: roundPrice(base),
                    clientPriceCOP: r.clientPriceCOP != null ? roundPrice(r.clientPriceCOP) : undefined,
                };
            });

            // Handle external results (round prices to 2 decimals)
            const external: ExternalResult[] = (data.externalResults || []).map((ext: any) => {
                const d = ext || {};
                const rounded = { ...d };
                if (typeof d.minPriceUSD === 'number') rounded.minPriceUSD = roundPrice(d.minPriceUSD);
                if (typeof d.minPriceCOP === 'number') rounded.minPriceCOP = roundPrice(d.minPriceCOP);
                if (typeof d.listPriceCOP === 'number') rounded.listPriceCOP = roundPrice(d.listPriceCOP);
                return { source: d.source || 'external', data: rounded };
            });

            // Sort results by stock availability with non-Costex priority
            const sortedResults = sortResultsByStockAvailability(results, external);
            setSearchResults(sortedResults.internal);
            setExternalResults(sortedResults.external);

            const searchType = likeSearch ? 'búsqueda similar' : 'búsqueda exacta';
            const externalCount = external.length > 0 ? ` + ${external.length} externos` : '';
            toast.success(`Se encontraron ${results.length} resultados para "${term}" (${searchType})${externalCount}`);
        } catch (error: any) {
            console.error('Search error:', error);
            toast.error(error.message || 'No se pudo completar la búsqueda. Inténtelo de nuevo.');
            setSearchResults([]);
            setExternalResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDeepWebSearch = async (term: string, clientIdOptional?: number, clientTypeOptional?: number) => {
        if (!term.trim()) {
            toast.error('Por favor ingrese un término de búsqueda');
            return;
        }

        // Clear any existing polling interval
        if ((window as any).deepWebPollInterval) {
            clearInterval((window as any).deepWebPollInterval);
            (window as any).deepWebPollInterval = null;
        }

        setIsDeepWebSearching(true);
        setSearchTerm(term);
        setClientId(clientIdOptional);
        setClientType(clientTypeOptional);
        // DON'T clear regular search results - keep them visible
        // setSearchResults([]); // REMOVED - keep normal search results
        // setExternalResults([]); // REMOVED - keep external results
        setDeepWebResultsByOrigin(new Map()); // Clear deep web results by origin
        setDeepWebOrigins([]); // Clear origins info
        setDeepWebErrors(new Map()); // Clear errors
        resultReceiverOrderRef.current = []; // Clear result receiver order
        // Set selected tab to first deep web origin (will be set after results load)
        // Set normal tab as selected if normal results exist, otherwise will be set to first deep web origin after load
        if (searchResults.length > 0 || externalResults.length > 0) {
            setSelectedOriginTab('NORMAL');
        } else {
            setSelectedOriginTab(''); // Will be set to first deep web origin after load
        }

        // Step 1: Fetch list of active sources
        let activeSourcesList: Array<{ originCode: string; originName: string }> = [];
        try {
            const sourcesResponse = await fetch('/api/config/endpoints');
            if (sourcesResponse.ok) {
                const sourcesData = await sourcesResponse.json();
                const activeSources = (sourcesData.endpoints || []).filter((e: any) => e.isActive);
                activeSourcesList = activeSources.map((e: any) => ({
                    originCode: e.originCode,
                    originName: e.name,
                }));
                setDeepWebSearchingSources(activeSourcesList);

                // Initialize origins list with all sources (pending state)
                const initialOrigins = activeSourcesList.map((source) => ({
                    originCode: source.originCode,
                    originName: source.originName,
                    productCount: 0,
                    hasError: false,
                }));
                setDeepWebOrigins(initialOrigins);
            } else {
                throw new Error('No se pudieron obtener las fuentes activas');
            }
        } catch (error) {
            console.error('Error fetching sources:', error);
            toast.error('No se pudieron obtener las fuentes activas');
            setIsDeepWebSearching(false);
            return;
        }

        if (activeSourcesList.length === 0) {
            toast.error('No hay fuentes activas configuradas');
            setIsDeepWebSearching(false);
            return;
        }

        // Step 2: Make one request per source (all in parallel)
        const allPromises = activeSourcesList.map(async (source) => {
            try {
                console.log(`[DEEP-WEB-SINGLE] Starting search for ${source.originCode}...`);

                const response = await fetch(`/api/search/deep-web/${source.originCode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference: term,
                        clientId: clientIdOptional,
                        clientType: clientTypeOptional ?? DEFAULT_CLIENT_TYPE_NO_CLIENT
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData?.error || `Error en ${source.originName}`);
                }

                const data = await response.json();

                if (data.success && data.products) {
                    // Convert products to SearchResult format (prices with 2 decimals)
                    const originResults: SearchResult[] = data.products.map((product: any) => ({
                        reference: product.reference,
                        stockQty: product.stock || 0,
                        basePriceCOP: roundPrice(product.price || 0),
                        hasStock: product.hasStock || false,
                        location: product.location,
                        description: product.description || `${product.origin || source.originCode} - ${product.reference}`,
                        origin: product.origin || source.originCode,
                    }));

                    // Track result receiver order - add this originCode to the order list (synchronously using ref)
                    if (!resultReceiverOrderRef.current.includes(source.originCode)) {
                        resultReceiverOrderRef.current.push(source.originCode);
                    }

                    // Update results by origin immediately
                    setDeepWebResultsByOrigin((prev) => {
                        const updated = new Map(prev);
                        updated.set(source.originCode, originResults);
                        return updated;
                    });

                    // Update origins list
                    setDeepWebOrigins((prev) => {
                        const updated = prev.map((o) =>
                            o.originCode === source.originCode
                                ? { ...o, productCount: originResults.length, hasError: false }
                                : o
                        );

                        // Sort origins by result receiver order (using ref for current order)
                        const order = [...resultReceiverOrderRef.current];

                        return updated.sort((a, b) => {
                            const aIndex = order.indexOf(a.originCode);
                            const bIndex = order.indexOf(b.originCode);
                            // If not in order list, put at end
                            if (aIndex === -1 && bIndex === -1) return 0;
                            if (aIndex === -1) return 1;
                            if (bIndex === -1) return -1;
                            return aIndex - bIndex;
                        });
                    });

                    // Set first origin as selected tab if not set
                    setSelectedOriginTab((prev) => {
                        // Don't auto-switch to deep web tab if normal results exist and normal tab is selected
                        // Only auto-switch if no tab is selected AND no normal results exist
                        if (!prev && (searchResults.length === 0 && externalResults.length === 0)) {
                            return source.originCode;
                        }
                        // If normal tab is selected, keep it selected
                        if (prev === 'NORMAL' || (!prev && (searchResults.length > 0 || externalResults.length > 0))) {
                            return 'NORMAL';
                        }
                        return prev;
                    });

                    // Update all results
                    setDeepWebResults((prev) => {
                        // Remove old results from this origin
                        const filtered = prev.filter((r) => r.origin !== source.originCode);
                        // Add new results
                        return [...filtered, ...originResults];
                    });

                    console.log(`[DEEP-WEB-SINGLE] ✅ ${source.originName}: ${originResults.length} products`);
                    return { originCode: source.originCode, success: true, count: originResults.length };
                } else {
                    // Error from source
                    const errorMsg = data.error || 'Error desconocido';

                    setDeepWebErrors((prev) => {
                        const updated = new Map(prev);
                        updated.set(source.originCode, errorMsg);
                        return updated;
                    });

                    // Track result receiver order for errors too (so they appear in order)
                    if (!resultReceiverOrderRef.current.includes(source.originCode)) {
                        resultReceiverOrderRef.current.push(source.originCode);
                    }

                    setDeepWebOrigins((prev) => {
                        // Check if origin already exists
                        const existing = prev.find((o) => o.originCode === source.originCode);

                        let updated: Array<{ originCode: string; originName: string; productCount: number; hasError?: boolean }>;

                        if (existing) {
                            // Update existing origin
                            updated = prev.map((o) =>
                                o.originCode === source.originCode
                                    ? { ...o, hasError: true, productCount: 0 }
                                    : o
                            );
                        } else {
                            // Add new origin with error
                            updated = [
                                ...prev,
                                {
                                    originCode: source.originCode,
                                    originName: source.originName,
                                    productCount: 0,
                                    hasError: true,
                                },
                            ];
                        }

                        // Sort origins by result receiver order (using ref for current order)
                        const order = [...resultReceiverOrderRef.current];

                        return updated.sort((a, b) => {
                            const aIndex = order.indexOf(a.originCode);
                            const bIndex = order.indexOf(b.originCode);
                            // If not in order list, put at end
                            if (aIndex === -1 && bIndex === -1) return 0;
                            if (aIndex === -1) return 1;
                            if (bIndex === -1) return -1;
                            return aIndex - bIndex;
                        });
                    });

                    console.error(`[DEEP-WEB-SINGLE] ❌ ${source.originName}: ${errorMsg}`);
                    return { originCode: source.originCode, success: false, error: errorMsg };
                }
            } catch (error: any) {
                console.error(`[DEEP-WEB-SINGLE] Error for ${source.originCode}:`, error);

                // Track result receiver order for errors too
                if (!resultReceiverOrderRef.current.includes(source.originCode)) {
                    resultReceiverOrderRef.current.push(source.originCode);
                }

                setDeepWebErrors((prev) => {
                    const updated = new Map(prev);
                    updated.set(source.originCode, error.message || 'Error de conexión');
                    return updated;
                });

                setDeepWebOrigins((prev) => {
                    // Check if origin already exists
                    const existing = prev.find((o) => o.originCode === source.originCode);

                    let updated: Array<{ originCode: string; originName: string; productCount: number; hasError?: boolean }>;

                    if (existing) {
                        // Update existing origin
                        updated = prev.map((o) =>
                            o.originCode === source.originCode
                                ? { ...o, hasError: true, productCount: 0 }
                                : o
                        );
                    } else {
                        // Add new origin with error
                        updated = [
                            ...prev,
                            {
                                originCode: source.originCode,
                                originName: source.originName,
                                productCount: 0,
                                hasError: true,
                            },
                        ];
                    }

                    // Sort origins by result receiver order (using ref for current order)
                    const order = [...resultReceiverOrderRef.current];

                    return updated.sort((a, b) => {
                        const aIndex = order.indexOf(a.originCode);
                        const bIndex = order.indexOf(b.originCode);
                        // If not in order list, put at end
                        if (aIndex === -1 && bIndex === -1) return 0;
                        if (aIndex === -1) return 1;
                        if (bIndex === -1) return -1;
                        return aIndex - bIndex;
                    });
                });

                return { originCode: source.originCode, success: false, error: error.message };
            }
        });

        // Wait for all requests to complete
        try {
            const results = await Promise.allSettled(allPromises);

            // Calculate totals
            const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.filter((r) => r.status === 'fulfilled' && !r.value.success).length +
                results.filter((r) => r.status === 'rejected').length;

            // Get total products from current state
            const totalProducts = Array.from(deepWebResultsByOrigin.values()).reduce(
                (sum, products) => sum + products.length,
                0
            );

            setIsDeepWebSearching(false);
            setDeepWebSearchingSources([]);

            const successMsg = `Búsqueda profunda: ${totalProducts} productos encontrados en ${successful} fuentes`;
            const errorMsg = failed > 0 ? ` (${failed} fuentes fallaron)` : '';

            toast.success(successMsg + errorMsg);
            console.log(`[DEEP-WEB-SINGLE] ✅ All searches complete: ${successful} successful, ${failed} failed`);
        } catch (error: any) {
            console.error('Deep web search error:', error);
            toast.error(error.message || 'Error al completar la búsqueda profunda');
            setIsDeepWebSearching(false);
            setDeepWebSearchingSources([]);
        }
    };

    // Clear all search results
    const clearSearchResults = () => {
        setSearchResults([]);
        setExternalResults([]);
        setDeepWebResults([]);
        setDeepWebResultsByOrigin(new Map());
        setDeepWebOrigins([]);
        setDeepWebErrors(new Map());
        setSelectedOriginTab('');
        setSearchTerm('');
    };

    const handleAddToQuote = (result: SearchResult, quantity: number = 1, shouldClearResults: boolean = true) => {
        console.log('handleAddToQuote called with:', result);

        // Check if this is a deep web result (has origin field)
        const isDeepWebResult = !!result.origin;
        const originName = isDeepWebResult
            ? deepWebOrigins.find(o => o.originCode === result.origin)?.originName || result.origin
            : undefined;

        addItemToQuote({
            reference: result.reference,
            stockQty: result.stockQty,
            basePriceCOP: result.basePriceCOP,
            clientPriceCOP: result.clientPriceCOP,
            hasStock: result.hasStock,
            location: result.location,
            description: result.description,
            source: isDeepWebResult ? 'third-party' : 'internal',
            sourceName: originName || 'Interno',
            weightPoundsPerUnit: result.weightPoundsPerUnit,
        }, quantity); // Pasar cantidad aqui

        // Automatically show the quote builder when an item is added
        setShowQuoteBuilder(true);

        // Clear search results after adding (optional)
        if (shouldClearResults) {
            clearSearchResults();
        }

        console.log('Item added to quote and quote builder shown');
    };

    const handleAddManualReference = (reference: string, price: number, description?: string, brand?: string) => {
        addItemToQuote({
            reference: reference,
            stockQty: 0, // Manual references have no stock
            basePriceCOP: price,
            clientPriceCOP: price, // Always show this price in builder (tipo A / entered price)
            hasStock: false, // Manual references are considered out of stock
            location: undefined,
            description: description || `Referencia agregada manualmente`,
            source: 'internal',
            sourceName: 'Interno',
            brand: brand,
        });

        toast.success(`Referencia "${reference}" agregada a la cotización`);
        setShowQuoteBuilder(true);
    };

    const handleAddThirdPartySource = (reference: string, price: number, sourceName: string, location?: string, stockQty?: number, customDescription?: string, origin?: string, brand?: string, quantity: number = 1, shouldClearResults: boolean = true, baseCost?: number, weightPoundsPerUnit?: number) => {
        // Use custom description if provided, otherwise fall back to default format
        // If customDescription is provided and already has provider info, use it as-is
        let description = customDescription;
        if (!description) {
            // Build description from sourceName and location
            description = `Proveedor: ${sourceName}${location ? ` - ${location}` : ''}`;
        }

        const costForItem = typeof baseCost === 'number' && Number.isFinite(baseCost) ? baseCost : price;
        addItemToQuote({
            reference: reference,
            stockQty: stockQty || 0, // Use actual stock quantity from location
            basePriceCOP: costForItem, // Cost (raw); use baseCost when provided (e.g. Costex)
            clientPriceCOP: price, // Selling price (tipo A when no client; client-specific when client selected)
            hasStock: (stockQty || 0) > 0, // Consider stock based on location availability
            location: location,
            description: description,
            source: 'third-party',
            sourceName: sourceName,
            origin: origin,
            brand: brand,
            weightPoundsPerUnit,
        }, quantity); // Pasar cantidad aqui

        const locationText = location ? ` desde ${location}` : '';
        toast.success(`${quantity} unidad(es) de "${reference}" de ${sourceName}${locationText} agregadas a la cotización`);
        setShowQuoteBuilder(true);
        
        // Clear search results after adding (optional)
        if (shouldClearResults) {
            clearSearchResults();
        }
    };

    // Handle batch search processing
    const handleBatchProcess = async (references: Array<{ reference: string; quantity: number }>) => {
        setIsBatchProcessing(true);
        
        try {
            const response = await fetch('/api/search/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    references,
                    clientId,
                    clientType: clientType ?? DEFAULT_CLIENT_TYPE_NO_CLIENT
                })
            });

            if (!response.ok) {
                throw new Error('Error en la búsqueda masiva');
            }

            const data = await response.json();

            // Add found products to cart
            let addedCount = 0;
            data.results.forEach((result: any) => {
                if (result.status === 'found' || result.status === 'partial_stock') {
                    if (result.product) {
                        const isDeepWeb = result.source === 'deepweb';
                        const isCostex = result.source === 'costex';
                        
                        // Determinar cantidad a agregar:
                        // - Si 'found': hay stock suficiente, usar cantidad solicitada del Excel
                        // - Si 'partial_stock': no hay suficiente, usar cantidad disponible
                        const quantityToAdd = result.status === 'found' 
                            ? result.requestedQty 
                            : result.availableQty;
                        
                        addItemToQuote({
                            reference: result.product.reference,
                            stockQty: result.availableQty, // Info del stock disponible
                            basePriceCOP: isCostex && result.product.baseCostUSD != null ? result.product.baseCostUSD : result.product.price,
                            clientPriceCOP: result.product.clientPrice || result.product.price,
                            hasStock: result.availableQty > 0,
                            location: result.product.location,
                            description: result.product.description,
                            source: (isCostex || isDeepWeb) ? 'third-party' : 'internal',
                            sourceName: result.sourceName || 'Interno',
                            origin: result.origin
                        }, quantityToAdd); // Usar cantidad correcta
                        addedCount++;
                    }
                }
            });

            // Show results modal with problems
            const notFoundRefs = data.results
                .filter((r: any) => r.status === 'not_found')
                .map((r: any) => ({ reference: r.reference, requestedQty: r.requestedQty }));
            
            const partialStockRefs = data.results
                .filter((r: any) => r.status === 'partial_stock')
                .map((r: any) => ({
                    reference: r.reference,
                    requestedQty: r.requestedQty,
                    availableQty: r.availableQty,
                    addedToCart: true
                }));

            setBatchResults({ notFoundRefs, partialStockRefs });
            setShowBatchModal(true);
            setShowQuoteBuilder(true);

            if (addedCount > 0) {
                toast.success(`${addedCount} referencia(s) agregadas a la cotización`);
            }

            if (data.summary.notFound > 0 || data.summary.partialStock > 0) {
                toast(`${data.summary.notFound} no encontradas, ${data.summary.partialStock} con stock parcial`, {
                    icon: '⚠️',
                    duration: 4000
                });
            }

            clearSearchResults();
        } catch (error: any) {
            console.error('Batch search error:', error);
            toast.error(error.message || 'Error al procesar la búsqueda masiva');
        } finally {
            setIsBatchProcessing(false);
        }
    };

    // Handle retry search for a single reference from modal
    const handleRetrySearch = async (originalReference: string, newReference: string) => {
        toast(`Buscando "${newReference}"...`, {
            icon: 'ℹ️',
            duration: 2000
        });
        
        try {
            const response = await fetch('/api/search/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    references: [{ reference: newReference, quantity: 1 }],
                    clientId,
                    clientType
                })
            });

            const data = await response.json();
            const result = data.results[0];

            if (result.status === 'found' || result.status === 'partial_stock') {
                // Add to cart
                if (result.product) {
                    const isDeepWeb = result.source === 'deepweb';
                    const isCostex = result.source === 'costex';
                    
                    addItemToQuote({
                        reference: result.product.reference,
                        stockQty: result.availableQty,
                        basePriceCOP: isCostex && result.product.baseCostUSD != null ? result.product.baseCostUSD : result.product.price,
                        clientPriceCOP: result.product.clientPrice || result.product.price,
                        hasStock: result.availableQty > 0,
                        location: result.product.location,
                        description: result.product.description,
                        source: (isCostex || isDeepWeb) ? 'third-party' : 'internal',
                        sourceName: result.sourceName || 'Interno',
                        origin: result.origin
                    }, result.availableQty);
                }

                // Remove from not found list
                if (batchResults) {
                    setBatchResults({
                        ...batchResults,
                        notFoundRefs: batchResults.notFoundRefs.filter((r: any) => r.reference !== originalReference)
                    });
                }

                toast.success(`Referencia "${newReference}" encontrada y agregada`);
            } else {
                toast.error(`Referencia "${newReference}" no encontrada`);
            }
        } catch (error) {
            toast.error('Error al buscar la referencia');
        }
    };

    // Handle remove reference from not found list
    const handleRemoveReference = (reference: string) => {
        if (batchResults) {
            setBatchResults({
                ...batchResults,
                notFoundRefs: batchResults.notFoundRefs.filter((r: any) => r.reference !== reference)
            });
        }
        toast.success(`Referencia "${reference}" eliminada de la lista`);
    };

    const handleQuoteUpdated = () => {
        // Refresh the quotes page by navigating to it
        router.push('/quotes');
    };

    const handleOrderUpdated = () => {
        router.push('/orders');
    };

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
        <div className="space-y-6 pb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">Buscar Repuestos</h1>
                    {quoteMode && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${quoteMode === 'editing' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {quoteMode === 'editing' ? 'Editando Cotización' : 'Creando Cotización'}
                        </span>
                    )}
                </div>
                <p className="mt-2 text-base text-gray-600">Encuentra los productos que necesitas y agrégalos fácilmente a tu cotización.</p>
            </div>

            <div className="card overflow-visible shadow-md">
                <div className="card-header bg-gradient-to-r from-gray-50 to-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">🔍 Buscar Piezas</h2>
                </div>
                
                {/* Search Mode Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px px-6">
                        <button
                            onClick={() => setSearchMode('single')}
                            className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                                searchMode === 'single'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <MagnifyingGlassIcon className="h-5 w-5" />
                                Búsqueda Individual
                            </span>
                        </button>
                        <button
                            onClick={() => setSearchMode('batch')}
                            className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                                searchMode === 'batch'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5" />
                                Búsqueda Masiva (Excel)
                            </span>
                        </button>
                    </nav>
                </div>

                <div className="card-body overflow-visible">
                    {searchMode === 'single' ? (
                        <SearchForm
                            onSearch={handleSearch}
                            onDeepWebSearch={handleDeepWebSearch}
                            onAddManualReference={handleAddManualReference}
                            isLoading={isSearching}
                            isDeepWebSearching={isDeepWebSearching}
                        />
                    ) : (
                        <ExcelUploader
                            onProcessStart={() => {}}
                            onProcessComplete={handleBatchProcess}
                            clientId={clientId}
                            clientType={clientType}
                            isProcessing={isBatchProcessing}
                        />
                    )}
                </div>
            </div>

            {/* Main content area - always show grid when there are search results OR when quote builder is open */}
            {(searchResults.length > 0 || externalResults.length > 0 || deepWebResults.length > 0 || showQuoteBuilder) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left side - Unified Search Results (only when there are results) */}
                    {(searchResults.length > 0 || externalResults.length > 0 || deepWebOrigins.length > 0) && (
                        <div className="lg:col-span-2">
                            <div className="card shadow-md">
                                <div className="card-header bg-gradient-to-r from-blue-50 to-indigo-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <h2 className="text-xl font-semibold text-gray-900">
                                                        📦 Resultados de Búsqueda
                                                    </h2>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {deepWebResults.length > 0
                                                            ? 'Ver resultados por fuente en las pestañas'
                                                            : `${searchResults.length + externalResults.length} producto(s) encontrado(s)`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body bg-gray-50">
                                    {deepWebOrigins.length > 0 ? (
                                        // Deep Web Results Display with Tabs
                                        <div>
                                            {/* Tabs - include "Búsqueda Normal" tab + all deep web origin tabs */}
                                            <div className="border-b border-gray-200 mb-4">
                                                <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                                                    {/* Normal Search Tab - show if we have normal search results */}
                                                    {(searchResults.length > 0 || externalResults.length > 0) && (
                                                        <button
                                                            onClick={() => setSelectedOriginTab('NORMAL')}
                                                            className={`
                                                                whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm
                                                                ${selectedOriginTab === 'NORMAL' || !selectedOriginTab
                                                                    ? 'border-blue-500 text-blue-600'
                                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                                }
                                                            `}
                                                        >
                                                            Búsqueda Normal ({searchResults.length + externalResults.length})
                                                        </button>
                                                    )}

                                                    {/* Deep Web Origin Tabs */}
                                                    {deepWebOrigins.map((originInfo) => {
                                                        const originCode = originInfo.originCode;
                                                        const results = deepWebResultsByOrigin.get(originCode) || [];
                                                        const isSelected = selectedOriginTab === originCode;
                                                        const hasError = deepWebErrors.has(originCode);
                                                        const isSearching = isDeepWebSearching && !deepWebResultsByOrigin.has(originCode) && !hasError;

                                                        return (
                                                            <button
                                                                key={originCode}
                                                                onClick={() => setSelectedOriginTab(originCode)}
                                                                className={`
                                                                    whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm flex items-center gap-2
                                                                    ${isSelected
                                                                        ? 'border-blue-500 text-blue-600'
                                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                                    }
                                                                    ${hasError ? 'text-red-600' : ''}
                                                                `}
                                                            >
                                                                {isSearching && (
                                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                                                )}
                                                                {!isSearching && !hasError && results.length > 0 && (
                                                                    <span className="text-green-500">✓</span>
                                                                )}
                                                                {hasError && <span className="text-red-500">⚠️</span>}
                                                                {originInfo.originName} ({results.length})
                                                            </button>
                                                        );
                                                    })}
                                                </nav>
                                            </div>

                                            {/* Tab Content */}
                                            <div className="space-y-4">

                                                {/* Normal Search Tab Content - Always show when normal tab is selected, even during deep web search */}
                                                {(selectedOriginTab === 'NORMAL' || !selectedOriginTab) && (searchResults.length > 0 || externalResults.length > 0) && (
                                                    <UnifiedSearchResults
                                                        key="normal-search-results"
                                                        internalResults={searchResults}
                                                        externalResults={externalResults}
                                                        onAddToQuote={handleAddToQuote}
                                                        onAddThirdPartySource={handleAddThirdPartySource}
                                                        onClearResults={clearSearchResults}
                                                        clientId={clientId}
                                                        userRole={session?.user?.role}
                                                        context="quote"
                                                    />
                                                )}

                                                {/* Deep Web Origin Tab Content - Show results even while searching */}
                                                {deepWebOrigins.map((originInfo) => {
                                                    const originCode = originInfo.originCode;
                                                    const results = deepWebResultsByOrigin.get(originCode) || [];
                                                    const isSelected = selectedOriginTab === originCode;
                                                    const isSearching = isDeepWebSearching && !deepWebResultsByOrigin.has(originCode) && !deepWebErrors.has(originCode);

                                                    if (!isSelected) return null;

                                                    // Show loading state if still searching and no results yet
                                                    if (isSearching && results.length === 0) {
                                                        return (
                                                            <div key={`loading-${originCode}`} className="text-center py-8">
                                                                <div className="flex items-center justify-center space-x-3">
                                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                                    <p className="text-gray-600">Buscando en {originInfo.originName}...</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    // Show empty state if no results and not searching
                                                    if (results.length === 0 && !isSearching) {
                                                        const hasError = deepWebErrors.has(originCode);
                                                        const errorMessage = deepWebErrors.get(originCode);
                                                        return (
                                                            <div key={`empty-${originCode}`} className="text-center py-8">
                                                                <p className="text-gray-500">No se encontraron resultados en {originInfo.originName}</p>
                                                                <p className="text-sm text-gray-400 mt-2">
                                                                    {hasError ? (errorMessage || 'Hubo un error al buscar en esta fuente') : 'La búsqueda no encontró productos coincidentes'}
                                                                </p>
                                                            </div>
                                                        );
                                                    }

                                                    // Show results (even if search is still ongoing for other sources)
                                                    return (
                                                        <div key={`results-${originCode}`} className="space-y-4">
                                                            {isDeepWebSearching && results.length > 0 && (
                                                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                                    <p className="text-sm text-blue-700 flex items-center">
                                                                        <span className="mr-2">✓</span>
                                                                        {results.length} producto{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''} en {originInfo.originName}
                                                                        {isDeepWebSearching && (
                                                                            <span className="ml-2 text-xs text-blue-600">(Búsqueda en progreso...)</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                                {results.map((result, index) => {
                                                                    // Add directly for all users
                                                                    const handleAddProduct = (quantity: number) => {
                                                                        // Pasar la cantidad directamente, sin loop
                                                                        handleAddToQuote(result, quantity, false);
                                                                        toast.success(`${quantity} unidad(es) de ${result.reference} agregadas a la cotización`);
                                                                        
                                                                        // Clear search results after adding
                                                                        clearSearchResults();
                                                                    };

                                                                    // Edit before add - only for admins/agents
                                                                    const handleEditBeforeAdd = () => {
                                                                        setShowDeepWebForm({
                                                                            isOpen: true,
                                                                            result: result,
                                                                            originName: originInfo.originName
                                                                        });
                                                                    };

                                                                    return (
                                                                        <ProductCard
                                                                            key={`${result.reference}-${index}-${originCode}`}
                                                                            reference={result.reference}
                                                                            description={result.description}
                                                                            stockQty={result.stockQty}
                                                                            hasStock={result.hasStock}
                                                                            priceCOP={result.basePriceCOP}
                                                                            priceCurrency="COP"
                                                                            location={result.location}
                                                                            source="external"
                                                                            sourceName={originInfo.originName}
                                                                            onAddToQuote={handleAddProduct}
                                                                            showSource={session?.user?.role !== 'client'}
                                                                            onEditBeforeAdd={session?.user?.role !== 'client' ? handleEditBeforeAdd : undefined}
                                                                            showEditButton={session?.user?.role !== 'client'}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <UnifiedSearchResults
                                            internalResults={searchResults}
                                            externalResults={externalResults}
                                            onAddToQuote={handleAddToQuote}
                                            onAddThirdPartySource={handleAddThirdPartySource}
                                            onClearResults={clearSearchResults}
                                            clientId={clientId}
                                            userRole={session?.user?.role}
                                            context="quote"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right side - Order Builder (when client selected) or Quote Builder (when no client) */}
                    {showQuoteBuilder && (clientId ?? currentQuote?.clientId) && (
                        <div className={(searchResults.length > 0 || externalResults.length > 0 || deepWebResults.length > 0) ? "lg:col-span-1" : "lg:col-span-3"}>
                            <OrderBuilder
                                items={currentQuote?.items || []}
                                onClose={() => setShowQuoteBuilder(false)}
                                clientId={clientId ?? currentQuote?.clientId ?? 0}
                                onOrderUpdated={handleOrderUpdated}
                            />
                        </div>
                    )}
                    {showQuoteBuilder && !(clientId ?? currentQuote?.clientId) && (
                        <div className={(searchResults.length > 0 || externalResults.length > 0 || deepWebResults.length > 0) ? "lg:col-span-1" : "lg:col-span-3"}>
                            <QuoteBuilder
                                items={currentQuote?.items || []}
                                onClose={() => setShowQuoteBuilder(false)}
                                agentId={parseInt(session?.user?.id || '0')}
                                clientId={clientId}
                                isEditing={quoteMode === 'editing'}
                                editingQuoteId={getEditingQuoteId() || undefined}
                                onQuoteUpdated={handleQuoteUpdated}
                                userRole={session?.user?.role}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Persistent Quote Builder */}
            {currentQuote && currentQuote.items.length > 0 && !showQuoteBuilder && (
                <div className="card">
                    <div className="card-header">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium text-gray-900">
                                Cotización Actual ({getQuoteItemCount()} ítems)
                                {currentQuote?.clientName && (
                                    <span className="ml-2 text-sm font-normal text-gray-600">
                                        - Cliente: {currentQuote.clientName}
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={() => setShowQuoteBuilder(true)}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                <span>Ver Cotización</span>
                            </button>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {currentQuote.items.slice(0, 6).map((item) => (
                                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <h4 className="text-sm font-medium text-gray-900">{item.reference}</h4>
                                                {item.source === 'third-party' && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                        {item.sourceName || 'Externo'}
                                                    </span>
                                                )}
                                                {!item.hasStock && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                        Sin Stock
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">Cantidad: {item.quantity}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">{formatCurrency(item.totalPrice)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {currentQuote.items.length > 6 && (
                                <div className="border border-gray-200 rounded-lg p-3 flex items-center justify-center">
                                    <span className="text-sm text-gray-500">
                                        +{currentQuote.items.length - 6} más...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Deep Web Form Modal */}
            {showDeepWebForm.isOpen && showDeepWebForm.result && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Agregar de Proveedor Externo
                            </h3>
                            <DeepWebFormModal
                                result={showDeepWebForm.result}
                                originName={showDeepWebForm.originName}
                                onAdd={(brand) => {
                                    handleAddThirdPartySource(
                                        showDeepWebForm.result!.reference,
                                        showDeepWebForm.result!.basePriceCOP,
                                        showDeepWebForm.originName,
                                        showDeepWebForm.result!.location,
                                        showDeepWebForm.result!.stockQty,
                                        showDeepWebForm.result!.description,
                                        showDeepWebForm.result!.origin,
                                        brand
                                    );
                                    setShowDeepWebForm({ isOpen: false, result: null, originName: '' });
                                }}
                                onCancel={() => setShowDeepWebForm({ isOpen: false, result: null, originName: '' })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isSearching && (
                <div className="card">
                    <div className="card-body text-center py-12">
                        <div className="spinner mx-auto h-8 w-8"></div>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Buscando...</h3>
                        <p className="mt-1 text-sm text-gray-500">Buscando piezas que coincidan con &quot;{searchTerm}&quot;</p>
                    </div>
                </div>
            )}

            {isDeepWebSearching && (
                <div className="card">
                    <div className="card-body py-12">
                        <div className="text-center">
                            <div className="spinner mx-auto h-8 w-8"></div>
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Búsqueda Profunda en Progreso</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Buscando &quot;{searchTerm}&quot; en todas las fuentes externas...
                            </p>
                        </div>

                        {deepWebSearchingSources.length > 0 && (
                            <div className="mt-6">
                                <p className="text-sm font-medium text-gray-700 mb-3 text-center">
                                    Buscando en {deepWebSearchingSources.length} fuente{deepWebSearchingSources.length !== 1 ? 's' : ''}:
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                                    {deepWebSearchingSources.map((source) => (
                                        <div
                                            key={source.originCode}
                                            className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"
                                        >
                                            <div className="flex-shrink-0">
                                                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                                            </div>
                                            <span className="text-sm text-gray-700 font-medium">{source.originName}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 text-center mt-4">
                                    Esto puede tomar varios segundos mientras se consultan todas las fuentes...
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Batch Results Modal */}
            {batchResults && (
                <BatchResultsModal
                    isOpen={showBatchModal}
                    onClose={() => setShowBatchModal(false)}
                    notFoundRefs={batchResults.notFoundRefs || []}
                    partialStockRefs={batchResults.partialStockRefs || []}
                    onRetrySearch={handleRetrySearch}
                    onRemove={handleRemoveReference}
                />
            )}
        </div>
    );
}
