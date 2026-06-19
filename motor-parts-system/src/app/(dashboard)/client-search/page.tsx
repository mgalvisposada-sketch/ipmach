'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { ClientSearchForm } from '@/components/forms/ClientSearchForm';
import { UnifiedSearchResults } from '@/components/search/UnifiedSearchResults';
import { OrderBuilder } from '@/components/search/OrderBuilder';
import ExcelUploader from '@/components/search/ExcelUploader';
import BatchResultsModal from '@/components/search/BatchResultsModal';
import { useQuote } from '@/contexts/QuoteContext';
import { formatCurrency } from '@/lib/utils';
import { ClientSourceConfig } from '@/types';
import { getEnabledSources } from '@/lib/utils/source-config';

/**
 * Dedupes ?q= auto-search across React Strict Mode remount (component ref resets).
 * Cleared when leaving /client-search (see pathname effect) so revisiting ?q= runs again.
 */
let lastClientSearchUrlParamsStr: string | null = null;

interface SearchResult {
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    origin?: string;
    /** Pounds per unit (e.g. Costex), for Miami carrier surcharge. */
    weightPoundsPerUnit?: number;
}

interface ExternalResult {
    source: string;
    data: any;
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
    const sortedInternal = [...internalResults].sort((a, b) => {
        if (a.hasStock && b.hasStock) {
            return b.stockQty - a.stockQty;
        }
        if (a.hasStock && !b.hasStock) {
            return -1;
        }
        if (!a.hasStock && b.hasStock) {
            return 1;
        }
        return 0;
    });

    const sortedExternal = [...externalResults].sort((a, b) => {
        const aHasStock = a.data.totalStock > 0;
        const bHasStock = b.data.totalStock > 0;
        const aStock = a.data.totalStock || 0;
        const bStock = b.data.totalStock || 0;

        if (aHasStock && bHasStock) {
            return bStock - aStock;
        }
        if (aHasStock && !bHasStock) {
            return -1;
        }
        if (!aHasStock && bHasStock) {
            return 1;
        }
        return 0;
    });

    return {
        internal: sortedInternal,
        external: sortedExternal
    };
}

export const dynamic = 'force-dynamic';

export default function ClientSearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { addItemToQuote, currentQuote, getQuoteItemCount, quoteMode, getEditingQuoteId } = useQuote();
    
    // Fixed client ID - session user
    const clientId = session?.user?.id ? parseInt(session.user.id) : undefined;
    const [clientType, setClientType] = useState<number | undefined>(2); // Default client type, will be loaded from database
    const [isLoadingClientInfo, setIsLoadingClientInfo] = useState(true);
    
    // Load client's source configuration ONCE on mount
    const [clientSourceConfig, setClientSourceConfig] = useState<ClientSourceConfig | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    
    // Search mode: 'single' for individual search, 'batch' for Excel upload
    const [searchMode, setSearchMode] = useState<'single' | 'batch'>('single');
    const prevSearchModeRef = useRef<'single' | 'batch'>('single');
    
    // Batch search states
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchResults, setBatchResults] = useState<any>(null);
    const [showBatchModal, setShowBatchModal] = useState(false);
    
    // REUSE: Same state management as /search
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [externalResults, setExternalResults] = useState<ExternalResult[]>([]);
    const [deepWebResults, setDeepWebResults] = useState<SearchResult[]>([]);
    const [deepWebResultsByOrigin, setDeepWebResultsByOrigin] = useState<Map<string, SearchResult[]>>(new Map());
    const [deepWebOrigins, setDeepWebOrigins] = useState<Array<{ originCode: string; originName: string; productCount: number }>>([]);
    const [deepWebErrors, setDeepWebErrors] = useState<Map<string, string>>(new Map());
    const [isSearching, setIsSearching] = useState(false);
    const [isDeepWebSearching, setIsDeepWebSearching] = useState(false);
    const [deepWebSearchingSources, setDeepWebSearchingSources] = useState<Array<{ originCode: string; originName: string }>>([]);
    const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
    // Default search term for the form (cleared when we have results so user can search again)
    const [formDefaultTerm, setFormDefaultTerm] = useState('');
    // Increment to force the search form to clear its input (needed when user typed and formDefaultTerm was already '')
    const [searchClearTrigger, setSearchClearTrigger] = useState(0);

    // Load client information (source config and clientType) on mount
    useEffect(() => {
        const loadClientInfo = async () => {
            if (!clientId) {
                setIsLoadingConfig(false);
                setIsLoadingClientInfo(false);
                return;
            }
            
            try {
                // Load client source configuration
                const configResponse = await fetch(`/api/users/${clientId}/source-config`);
                if (configResponse.ok) {
                    const configData = await configResponse.json();
                    setClientSourceConfig(configData.sourceConfig || { sources: [] });
                } else {
                    // Use default: empty config (will use defaults in search)
                    setClientSourceConfig({ sources: [] });
                }

                // Load client user info to get clientType
                const userResponse = await fetch(`/api/users/${clientId}`);
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.success && userData.data) {
                        const userClientType = userData.data.clientType;
                        if (userClientType !== undefined && userClientType !== null) {
                            setClientType(userClientType);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load client info:', error);
                setClientSourceConfig({ sources: [] });
            } finally {
                setIsLoadingConfig(false);
                setIsLoadingClientInfo(false);
            }
        };
        
        loadClientInfo();
    }, [clientId]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Auto-open the builder when a quote is present
    useEffect(() => {
        if (currentQuote && currentQuote.items && currentQuote.items.length > 0) {
            setShowQuoteBuilder(true);
        }
    }, [currentQuote]);

    // Sync form default term from URL on mount / when query param changes
    useEffect(() => {
        const q = searchParams?.get('q') || '';
        setFormDefaultTerm(q);
    }, [searchParams]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if ((window as any).deepWebPollInterval) {
                clearInterval((window as any).deepWebPollInterval);
                (window as any).deepWebPollInterval = null;
            }
        };
    }, []);

    // REUSE: Same local search handler (calls same API)
    const handleSearch = useCallback(
        async (term: string, likeSearch?: boolean) => {
            if (!term.trim()) {
                toast.error('Por favor ingrese un término de búsqueda');
                return;
            }

            setIsSearching(true);
            setSearchTerm(term);
            // Clear all deep web state when doing regular search
            setDeepWebResults([]);
            setDeepWebResultsByOrigin(new Map());
            setDeepWebOrigins([]);
            setDeepWebErrors(new Map());

            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference: term,
                        clientId,
                        clientType,
                        likeSearch,
                    }),
                });

                const data = await response.json();
                if (!response.ok) {
                    if (response.status === 403 && data?.error) {
                        toast.error(data.error);
                        setIsSearching(false);
                        return;
                    }
                    throw new Error(data?.error || 'La búsqueda falló');
                }

                const results: SearchResult[] = (data.data || []).map((r: any) => ({
                    ...r,
                    basePriceCOP: r.basePriceCOP || 0,
                }));

                const external: ExternalResult[] = (data.externalResults || []).map((ext: any) => ({
                    source: ext.source || 'external',
                    data: ext,
                }));

                const sortedResults = sortResultsByStockAvailability(results, external);
                setSearchResults(sortedResults.internal);
                setExternalResults(sortedResults.external);

                if (results.length > 0 || external.length > 0) {
                    setFormDefaultTerm('');
                    setSearchClearTrigger((t) => t + 1);
                }

                const searchType = likeSearch ? 'búsqueda similar' : 'búsqueda exacta';
                const externalCount = external.length > 0 ? ` + ${external.length} externos` : '';
                toast.success(
                    `Se encontraron ${results.length} resultados para "${term}" (${searchType})${externalCount}`
                );
            } catch (error: any) {
                console.error('Search error:', error);
                toast.error(error.message || 'No se pudo completar la búsqueda. Inténtelo de nuevo.');
                setSearchResults([]);
                setExternalResults([]);
            } finally {
                setIsSearching(false);
            }
        },
        [clientId, clientType]
    );

    useEffect(() => {
        if (pathname !== '/client-search') {
            lastClientSearchUrlParamsStr = null;
        }
    }, [pathname]);

    // Run the same search as the form when landing with ?q= (e.g. from global header)
    useEffect(() => {
        const q = (searchParams?.get('q') || '').trim();
        if (!q) {
            lastClientSearchUrlParamsStr = null;
            return;
        }
        if (!clientId || isLoadingClientInfo || isLoadingConfig) {
            return;
        }
        const paramsStr = searchParams?.toString() ?? '';
        if (lastClientSearchUrlParamsStr === paramsStr) {
            return;
        }
        lastClientSearchUrlParamsStr = paramsStr;
        void handleSearch(q, true);
    }, [searchParams, clientId, isLoadingClientInfo, isLoadingConfig, handleSearch]);

    // MODIFIED: Deep web search with source filtering and profit calculation
    const handleDeepWebSearch = async (term: string) => {
        if (!term.trim() || !clientSourceConfig || !clientId) return;

        // Clear any existing polling interval
        if ((window as any).deepWebPollInterval) {
            clearInterval((window as any).deepWebPollInterval);
            (window as any).deepWebPollInterval = null;
        }

        setIsDeepWebSearching(true);
        setSearchTerm(term);

        // Get enabled sources from client config
        const enabledSources = getEnabledSources(clientSourceConfig);

        if (enabledSources.length === 0) {
            setIsDeepWebSearching(false);
            return; // No enabled sources
        }

        // Fetch all active sources
        let activeSourcesList: Array<{ originCode: string; originName: string }> = [];
        try {
            const sourcesResponse = await fetch('/api/config/endpoints');
            if (sourcesResponse.ok) {
                const sourcesData = await sourcesResponse.json();
                // Filter to only enabled sources for this client
                const activeSources = (sourcesData.endpoints || []).filter(
                    (e: any) => e.isActive && enabledSources.includes(e.originCode)
                );
                activeSourcesList = activeSources.map((e: any) => ({
                    originCode: e.originCode,
                    originName: e.name,
                }));
                setDeepWebSearchingSources(activeSourcesList);

                // Initialize origins list with enabled sources only
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
            setIsDeepWebSearching(false);
            return;
        }

        // REUSE: Same parallel search logic as /search
        const allPromises = activeSourcesList.map(async (source) => {
            try {
                const response = await fetch(`/api/search/deep-web/${source.originCode}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference: term,
                        clientId,  // Pass clientId for profit calculation
                        clientType
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const msg = errorData?.error || `Error en ${source.originName}`;
                    if (response.status === 403) {
                        setDeepWebErrors((prev) => {
                            const updated = new Map(prev);
                            updated.set(source.originCode, msg);
                            return updated;
                        });
                        setDeepWebOrigins((prev) =>
                            prev.map((o) =>
                                o.originCode === source.originCode
                                    ? { ...o, hasError: true, productCount: 0 }
                                    : o
                            )
                        );
                        return { originCode: source.originCode, success: false, error: msg };
                    }
                    throw new Error(msg);
                }

                const data = await response.json();

                if (data.success && data.products) {
                    // Products already have profit applied in backend
                    const originResults: SearchResult[] = data.products.map((product: any) => ({
                        reference: product.reference,
                        stockQty: product.stock || 0,
                        basePriceCOP: product.price || 0, // Price already has profit applied in backend
                        hasStock: product.hasStock || false,
                        location: product.location,
                        description: product.description || `${product.origin || source.originCode} - ${product.reference}`,
                        origin: product.origin || source.originCode,
                    }));

                    // REUSE: Same state update logic
                    setDeepWebResultsByOrigin((prev) => {
                        const updated = new Map(prev);
                        updated.set(source.originCode, originResults);
                        return updated;
                    });

                    setDeepWebOrigins((prev) => {
                        return prev.map((o) =>
                            o.originCode === source.originCode
                                ? { ...o, productCount: originResults.length, hasError: false }
                                : o
                        );
                    });

                    setDeepWebResults((prev) => {
                        const filtered = prev.filter((r) => r.origin !== source.originCode);
                        return [...filtered, ...originResults];
                    });

                    return { originCode: source.originCode, success: true, count: originResults.length };
                } else {
                    const errorMsg = data.error || 'Error desconocido';
                    setDeepWebErrors((prev) => {
                        const updated = new Map(prev);
                        updated.set(source.originCode, errorMsg);
                        return updated;
                    });
                    setDeepWebOrigins((prev) => {
                        return prev.map((o) =>
                            o.originCode === source.originCode
                                ? { ...o, hasError: true, productCount: 0 }
                                : o
                        );
                    });
                    return { originCode: source.originCode, success: false, error: errorMsg };
                }
            } catch (error: any) {
                console.error(`Error for ${source.originCode}:`, error);
                setDeepWebErrors((prev) => {
                    const updated = new Map(prev);
                    updated.set(source.originCode, error.message || 'Error de conexión');
                    return updated;
                });
                setDeepWebOrigins((prev) => {
                    return prev.map((o) =>
                        o.originCode === source.originCode
                            ? { ...o, hasError: true, productCount: 0 }
                            : o
                    );
                });
                return { originCode: source.originCode, success: false, error: error.message };
            }
        });

        // REUSE: Same Promise.allSettled logic
        try {
            const results = await Promise.allSettled(allPromises);
            const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.filter((r) => r.status === 'fulfilled' && !r.value.success).length +
                results.filter((r) => r.status === 'rejected').length;
            const totalProducts = Array.from(deepWebResultsByOrigin.values()).reduce(
                (sum, products) => sum + products.length,
                0
            );

            setIsDeepWebSearching(false);
            setDeepWebSearchingSources([]);

            const totalFromSettled = results.reduce(
                (sum, r) => sum + (r.status === 'fulfilled' && r.value?.count ? r.value.count : 0),
                0
            );
            if (totalFromSettled > 0) {
                setFormDefaultTerm('');
                setSearchClearTrigger((t) => t + 1);
            }

            const successMsg = `Búsqueda externa: ${totalProducts} productos encontrados en ${successful} fuentes`;
            const errorMsg = failed > 0 ? ` (${failed} fuentes fallaron)` : '';
            toast.success(successMsg + errorMsg);
        } catch (error: any) {
            console.error('Deep web search error:', error);
            toast.error(error.message || 'Error al completar la búsqueda externa');
            setIsDeepWebSearching(false);
            setDeepWebSearchingSources([]);
        }
    };

    // REUSE: All other handlers (same as /search)
    // For client-search, use unique IDs to handle duplicate references
    // Clear all search results
    const clearSearchResults = useCallback(() => {
        setSearchResults([]);
        setExternalResults([]);
        setDeepWebResults([]);
        setDeepWebResultsByOrigin(new Map());
        setDeepWebOrigins([]);
        setDeepWebErrors(new Map());
        setSearchTerm('');
    }, []);

    /** Clears result cards, search field, and ?q= so stale individual searches do not linger. */
    const dismissIndividualSearch = useCallback(() => {
        clearSearchResults();
        setFormDefaultTerm('');
        setSearchClearTrigger((t) => t + 1);
        lastClientSearchUrlParamsStr = null;
        router.replace('/client-search');
    }, [clearSearchResults, router]);

    /** Single-search cards should not stay on screen when the user switches to bulk Excel flow. */
    useEffect(() => {
        if (prevSearchModeRef.current === 'single' && searchMode === 'batch') {
            dismissIndividualSearch();
        }
        prevSearchModeRef.current = searchMode;
    }, [searchMode, dismissIndividualSearch]);

    const handleAddToQuote = (result: SearchResult, quantity: number = 1, shouldClearResults: boolean = true) => {
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
            origin: result.origin, // Save origin code for admin view
            weightPoundsPerUnit: result.weightPoundsPerUnit,
        }, quantity); // Pasar cantidad aqui

        setShowQuoteBuilder(true);
        
        if (shouldClearResults) {
            dismissIndividualSearch();
        }
    };

    // Combine all results into a single unified list (only with stock)
    const getAllResults = (): SearchResult[] => {
        const allResults: SearchResult[] = [];
        
        // Add internal results (only with stock)
        allResults.push(...searchResults.filter(result => result.hasStock && result.stockQty > 0));
        
        // Add external results (Costex) - only with stock
        externalResults.forEach(external => {
            const data = external.data;
            if (!data) return;
            
            // Check for stock - calculate from locations if totalStock is not available
            let stockQty = data.totalStock || 0;
            
            // If totalStock is 0 or missing, try to calculate from locations
            if (stockQty === 0 && data.locations) {
                const locationValues = Object.values(data.locations) as any[];
                stockQty = locationValues.reduce((sum: number, loc: any) => {
                    return sum + (Number(loc.Quantity) || 0);
                }, 0);
            }
            
            // Only add if has stock
            if (stockQty > 0) {
                const displayPrice = (data.minPriceUSD != null && data.minPriceUSD > 0)
                    ? data.minPriceUSD
                    : (data.minPriceCOP > 0 ? data.minPriceCOP : data.listPriceCOP ?? 0);
                const baseCostUSD = data.baseCostUSD ?? data.calculation?.inputs?.baseCostUSD;
                const costForItem = typeof baseCostUSD === 'number' && Number.isFinite(baseCostUSD) ? baseCostUSD : displayPrice;
                const lbs =
                    typeof data.weight?.pounds === 'number' && Number.isFinite(data.weight.pounds)
                        ? data.weight.pounds
                        : undefined;
                allResults.push({
                    reference: data.partNumber,
                    stockQty: stockQty,
                    basePriceCOP: costForItem, // Raw cost (for order integration)
                    clientPriceCOP: clientId ? displayPrice : undefined, // Selling price
                    hasStock: true,
                    location: data.locations ? Object.values(data.locations).map((loc: any) => loc.BranchName?.trim()).join(', ') : undefined,
                    description: data.description || `Costex - ${data.partNumber}`,
                    weightPoundsPerUnit: lbs,
                });
            }
        });
        
        // Add deep web results (flatten all origins) - only with stock
        deepWebResults.forEach(result => {
            if (result.hasStock && result.stockQty > 0) {
                allResults.push(result);
            }
        });
        
        return allResults;
    };

    const handleAddThirdPartySource = (
        reference: string,
        price: number,
        sourceName: string,
        location?: string,
        stockQty?: number,
        customDescription?: string,
        origin?: string,
        brand?: string,
        quantity: number = 1,
        shouldClearResults: boolean = true,
        baseCost?: number,
        weightPoundsPerUnit?: number,
        costexLocationCode?: string
    ) => {
        let description = customDescription;
        if (!description) {
            description = `Proveedor: ${sourceName}${location ? ` - ${location}` : ''}`;
        }

        const costForItem = typeof baseCost === 'number' && Number.isFinite(baseCost) ? baseCost : price;
        addItemToQuote({
            reference: reference,
            stockQty: stockQty || 0,
            basePriceCOP: costForItem, // Cost (raw); use baseCost when provided (e.g. Costex)
            clientPriceCOP: clientId ? price : undefined, // Selling price
            hasStock: (stockQty || 0) > 0,
            location: location,
            description: description,
            source: 'third-party',
            sourceName: sourceName,
            origin: origin, // Save origin code for admin view
            ...(costexLocationCode != null && costexLocationCode !== ''
                ? { costexLocationCode }
                : {}),
            brand: brand,
            weightPoundsPerUnit,
        }, quantity); // Pasar cantidad aqui

        const locationText = location ? ` desde ${location}` : '';
        toast.success(`${quantity} unidad(es) de "${reference}" de ${sourceName}${locationText} agregadas a la orden`);
        setShowQuoteBuilder(true);
        
        if (shouldClearResults) {
            dismissIndividualSearch();
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
                    clientType
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 403 && data?.error) {
                    toast.error(data.error);
                    setIsBatchProcessing(false);
                    return;
                }
                throw new Error(data?.error || 'Error en la búsqueda masiva');
            }

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
                            origin: result.product.origin ?? result.origin,
                            ...(typeof result.product.costexLocationCode === 'string'
                                ? { costexLocationCode: result.product.costexLocationCode }
                                : {}),
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
                toast.success(`${addedCount} referencia(s) agregadas a la orden`);
            }

            if (data.summary.notFound > 0 || data.summary.partialStock > 0) {
                toast(`${data.summary.notFound} no encontradas, ${data.summary.partialStock} con stock parcial`, {
                    icon: '⚠️',
                    duration: 4000
                });
            }

            dismissIndividualSearch();
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

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 403 && data?.error) {
                    toast.error(data.error);
                    return;
                }
                throw new Error(data?.error || 'Error al buscar la referencia');
            }
            const result = data.results?.[0];
            if (!result) {
                toast.error('Error al obtener el resultado de la búsqueda');
                return;
            }

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
                        origin: result.product.origin ?? result.origin,
                        ...(typeof result.product.costexLocationCode === 'string'
                            ? { costexLocationCode: result.product.costexLocationCode }
                            : {}),
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
        router.push('/orders');
    };

    // Show loading while checking authentication or loading config
    if (status === 'loading' || isLoadingConfig) {
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
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Buscar Repuestos</h1>
                    {quoteMode && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${quoteMode === 'editing' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {quoteMode === 'editing' ? 'Editando Orden' : 'Creando Orden'}
                        </span>
                    )}
                </div>
                <p className="mt-1 text-sm text-gray-500">Busque repuestos y cree órdenes con los ítems seleccionados.</p>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="text-lg font-medium text-gray-900">Buscar Piezas</h2>
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

                <div className="card-body">
                    {searchMode === 'single' ? (
                        <ClientSearchForm
                            onSearch={handleSearch}
                            isLoading={isSearching}
                            isDeepWebSearching={isDeepWebSearching}
                            defaultSearchTerm={formDefaultTerm}
                            showClientIndicator={false}
                            clearTrigger={searchClearTrigger}
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

            {/* Main content area */}
            {(searchResults.length > 0 || externalResults.length > 0 || deepWebResults.length > 0 || showQuoteBuilder) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left side - Unified Search Results */}
                    {(searchResults.length > 0 || externalResults.length > 0 || deepWebOrigins.length > 0) && (
                        <div className="lg:col-span-2">
                            <div className="card">
                                <div className="card-header">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h2 className="text-lg font-medium text-gray-900">
                                                Resultados de Búsqueda
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {(() => {
                                                    const allResults = getAllResults();
                                                    return `${allResults.length} producto(s) encontrado(s)`;
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body">
                                    {/* Show unified results (all sources combined) - only show when there are results */}
                                    {(() => {
                                        const allResults = getAllResults();
                                        
                                        // Don't show anything if no results yet
                                        if (allResults.length === 0 && !isSearching && !isDeepWebSearching) {
                                            return null;
                                        }
                                        
                                        // Filter and convert results - only include items with stock
                                        const internalResultsForDisplay = [
                                            // Filter internal results - only with stock
                                            ...searchResults.filter(result => result.hasStock && result.stockQty > 0),
                                            // Filter and convert deep web results - only with stock
                                            ...deepWebResults
                                                .filter(result => result.hasStock && result.stockQty > 0)
                                                .map(result => ({
                                                    reference: result.reference,
                                                    stockQty: result.stockQty,
                                                    basePriceCOP: result.basePriceCOP,
                                                    clientPriceCOP: result.clientPriceCOP,
                                                    hasStock: result.hasStock,
                                                    location: result.location,
                                                    description: result.description?.replace(/\s*-\s*[A-Z0-9]+\s*$/, '') || result.description, // Remove origin from description
                                                }))
                                        ];

                                        // Filter external results - only with stock
                                        // Use same logic as UnifiedSearchResults component
                                        const externalResultsForDisplay = externalResults.filter(external => {
                                            const data = external.data;
                                            if (!data) return false;
                                            
                                            // Check for stock - Costex results have totalStock field
                                            // Calculate total stock from locations if totalStock is not available
                                            let stockQty = data.totalStock || 0;
                                            
                                            // If totalStock is 0 or missing, try to calculate from locations
                                            if (stockQty === 0 && data.locations) {
                                                const locationValues = Object.values(data.locations) as any[];
                                                stockQty = locationValues.reduce((sum: number, loc: any) => {
                                                    return sum + (Number(loc.Quantity) || 0);
                                                }, 0);
                                            }
                                            
                                            return stockQty > 0;
                                        });

                                        // Only render if we have results to show
                                        if (internalResultsForDisplay.length === 0 && externalResultsForDisplay.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <UnifiedSearchResults
                                                internalResults={internalResultsForDisplay}
                                                externalResults={externalResultsForDisplay}
                                                onAddToQuote={handleAddToQuote}
                                                onAddThirdPartySource={handleAddThirdPartySource}
                                                onClearResults={dismissIndividualSearch}
                                                clientId={clientId}
                                                userRole={session?.user?.role}
                                                context="order"
                                            />
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right side - Order Builder */}
                    {showQuoteBuilder && clientId && (
                        <div className={(searchResults.length > 0 || externalResults.length > 0 || deepWebResults.length > 0) ? "lg:col-span-1" : "lg:col-span-3"}>
                            <OrderBuilder
                                items={currentQuote?.items || []}
                                onClose={() => setShowQuoteBuilder(false)}
                                clientId={clientId}
                                onOrderUpdated={handleQuoteUpdated}
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
                                Orden Actual ({getQuoteItemCount()} ítems)
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
                                <span>Ver Orden</span>
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

            {searchTerm && searchResults.length === 0 && externalResults.length === 0 && deepWebResults.length === 0 && !isSearching && !isDeepWebSearching && (
                <div className="card border-2 border-amber-200 bg-amber-50/50">
                    <div className="card-body text-center py-16">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                            <MagnifyingGlassIcon className="h-10 w-10 text-amber-600" aria-hidden />
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-gray-900">Este producto no está disponible</h3>
                        <p className="mt-2 text-base text-gray-600 max-w-md mx-auto">
                            No encontramos coincidencias para la referencia &quot;{searchTerm}&quot; en inventario interno ni en proveedores configurados.
                        </p>
                        <p className="mt-1 text-sm text-gray-500">Pruebe con otra referencia o verifique el número de parte.</p>
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

