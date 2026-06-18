'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';
import { useQuote } from '@/contexts/QuoteContext';
import { useConfiguration } from '@/hooks/useConfiguration';

interface SearchFormProps {
    onSearch: (term: string, clientId?: number, hintedPrice?: number, clientType?: number, likeSearch?: boolean) => void;
    onDeepWebSearch?: (term: string, clientId?: number, clientType?: number) => void;
    onAddManualReference?: (reference: string, price: number, description?: string, brand?: string) => void;
    isLoading?: boolean;
    isDeepWebSearching?: boolean;
}

interface Client {
    id: number;
    name: string;
    discountRate: number;
    clientType?: number;
}

interface Suggestion {
    reference: string;
    label: string;
}

export function SearchForm({ onSearch, onDeepWebSearch, onAddManualReference, isLoading = false, isDeepWebSearching = false }: SearchFormProps) {
    const { data: session } = useSession();
    const { currentQuote, updateQuoteClient } = useQuote();
    const { configurations, loading: configLoading, getPricingConfig, getClientTypeConfigs } = useConfiguration();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
    const [selectedClientType, setSelectedClientType] = useState<number | undefined>();
    const [clientQuery, setClientQuery] = useState('');
    const [clientOptions, setClientOptions] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
    const clientAbortRef = useRef<AbortController | null>(null);

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const suggestAbortRef = useRef<AbortController | null>(null);
    const containerRef = useRef<HTMLFormElement | null>(null);


    // Manual reference functionality
    const [showManualReference, setShowManualReference] = useState(false);
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualDescription, setManualDescription] = useState<string>('');
    const [manualBrand, setManualBrand] = useState<string>('');


    // Load client information from quote when component mounts or quote changes
    // Only sync FROM quote TO form if form doesn't already have a client selected
    // This prevents overwriting user's manual selection
    useEffect(() => {
        if (currentQuote?.clientId && currentQuote?.clientName) {
            // Only update form if it doesn't have a client selected, or if the quote's client is different
            // This prevents the form from being reset when the quote is updated with items
            if (!selectedClientId || selectedClientId !== currentQuote.clientId) {
                setSelectedClientId(currentQuote.clientId);
                setSelectedClientType(currentQuote.clientType);
                setClientQuery(currentQuote.clientName);
            }
        } else if (selectedClientId && currentQuote && !currentQuote.clientId) {
            // If form has a client but quote doesn't, sync FROM form TO quote
            // This ensures the quote has the client when items are added
            // Only do this if quote exists but doesn't have a client (to avoid infinite loops)
            const clientName = clientQuery || `Client ${selectedClientId}`;
            updateQuoteClient(selectedClientId, clientName, selectedClientType);
        }
    }, [currentQuote, selectedClientId, selectedClientType, clientQuery, updateQuoteClient]);

    // Auto-set client for client role users
    useEffect(() => {
        if (session?.user?.role === 'client' && session?.user?.id) {
            // For clients, automatically set themselves as the client
            const clientId = parseInt(session.user.id);
            const clientName = session.user.name || 'Cliente';
            setSelectedClientId(clientId);
            setSelectedClientType(2); // Default client type for clients
            setClientQuery(clientName);
            updateQuoteClient(clientId, clientName, 2);
        }
    }, [session, updateQuoteClient]);

    // Client search: when typing (>=2 chars) or when dropdown opened with empty query (list all on focus)
    const fetchClients = async (term: string) => {
        clientAbortRef.current?.abort();
        const controller = new AbortController();
        clientAbortRef.current = controller;
        setIsLoadingClients(true);
        try {
            const params = term ? `searchTerm=${encodeURIComponent(term)}` : 'limit=50';
            const res = await fetch(`/api/clients/search?${params}`, { signal: controller.signal });
            const data = await res.json();
            const list: Client[] = (data?.clients || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                discountRate: typeof c.discountRate === 'number' ? c.discountRate : 0,
                clientType: c.clientType,
            }));
            setClientOptions(list);
        } catch (_) {
            // ignore
        } finally {
            setIsLoadingClients(false);
        }
    };

    useEffect(() => {
        const q = clientQuery.trim();
        if (q.length >= 2) {
            const handler = setTimeout(() => fetchClients(q), 300);
            return () => clearTimeout(handler);
        }
        if (q.length === 0) {
            setClientOptions([]);
        }
    }, [clientQuery]);

    const handleClientInputFocus = () => {
        setClientDropdownOpen(true);
        if (!clientQuery.trim()) {
            fetchClients('');
        }
    };

    const handleClientInputBlur = () => {
        setTimeout(() => setClientDropdownOpen(false), 200);
    };

    // Debounced suggestions
    useEffect(() => {
        if (!searchTerm.trim()) {
            setSuggestions([]);
            return;
        }
        const handler = setTimeout(async () => {
            try {
                suggestAbortRef.current?.abort();
                const controller = new AbortController();
                suggestAbortRef.current = controller;
                setIsLoadingSuggestions(true);
                const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(searchTerm.trim())}`, {
                    signal: controller.signal,
                });
                const data = await res.json();
                const newSuggestions = data.suggestions || [];
                setSuggestions(newSuggestions);
                setShowSuggestions(true);
            } catch (e) {
                // ignore abort errors
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const findHintedPrice = (term: string): number | undefined => {
        // No longer using price from suggestions
        return undefined;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            setShowSuggestions(false);
            // When Enter is pressed, perform a "like" search to find similar references
            onSearch(searchTerm.trim(), selectedClientId, findHintedPrice(searchTerm.trim()), selectedClientType, true);
        }
    };

    const handlePickSuggestion = (ref: string) => {
        setSearchTerm(ref);
        setShowSuggestions(false);
        // When clicking on a suggestion, perform an exact search
        onSearch(ref, selectedClientId, findHintedPrice(ref), selectedClientType, false);
    };

    const handleClear = () => {
        setSearchTerm('');
        setSelectedClientId(undefined);
        setSelectedClientType(undefined);
        setClientQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
        setShowManualReference(false);
        setManualPrice(0);
        setManualDescription('');
        setManualBrand('');

        // Clear client from quote
        if (currentQuote) {
            updateQuoteClient(0, '', undefined);
        }
    };

    const handleAddManualReference = () => {
        if (!searchTerm.trim()) {
            return;
        }
        if (onAddManualReference) {
            onAddManualReference(searchTerm.trim(), manualPrice, manualDescription.trim() || undefined, manualBrand.trim() || undefined);
            setShowManualReference(false);
            setManualPrice(0);
            setManualDescription('');
            setManualBrand('');
        }
    };

    return (
        <div className="space-y-4">

            <form onSubmit={handleSubmit} className="space-y-4" ref={containerRef}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Search Term */}
                    <div className="relative">
                        <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">
                            Referencia de Pieza
                        </label>
                        <div className="mt-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="searchTerm"
                                name="searchTerm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => searchTerm && setShowSuggestions(true)}
                                className="input-field pl-10"
                                placeholder="Ingrese referencia de pieza (ej., ABC123)"
                                disabled={isLoading}
                                required
                            />
                            {/* Suggestions dropdown */}
                            {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                    {isLoadingSuggestions && (
                                        <div className="px-3 py-2 text-sm text-gray-500">Buscando...</div>
                                    )}
                                    {suggestions.map((s) => (
                                        <button
                                            type="button"
                                            key={s.reference}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                            onClick={() => handlePickSuggestion(s.reference)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-medium text-gray-900">{s.reference}</span>
                                                        {s.label && s.label !== s.reference && (
                                                            <span className="text-gray-500">{s.label}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Client Selection (Optional) - Hidden for clients */}
                    {session?.user?.role !== 'client' && (
                        <div className="relative">
                            <label htmlFor="clientSearch" className="block text-sm font-medium text-gray-700">
                                Cliente (Opcional)
                            </label>
                            <div className="mt-1 relative">
                                <input
                                    type="text"
                                    id="clientSearch"
                                    name="clientSearch"
                                    value={clientQuery}
                                    onChange={(e) => setClientQuery(e.target.value)}
                                    onFocus={handleClientInputFocus}
                                    onBlur={handleClientInputBlur}
                                    className="input-field"
                                    placeholder="Buscar cliente por nombre o código (o haga clic para ver lista)"
                                    disabled={isLoading}
                                />
                                {(clientOptions.length > 0 || isLoadingClients) && (clientQuery.length >= 2 || clientDropdownOpen) && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-[70vh] min-h-[8rem] overflow-y-auto overflow-x-hidden">
                                        {isLoadingClients && (
                                            <div className="px-3 py-2 text-sm text-gray-500">Cargando clientes...</div>
                                        )}
                                        {!isLoadingClients && clientOptions.length > 0 && (
                                            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
                                                Cliente — Tipo cliente
                                            </div>
                                        )}
                                        {clientOptions.map((c) => (
                                            <button
                                                type="button"
                                                key={c.id}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                                                onClick={() => {
                                                    setSelectedClientId(c.id);
                                                    setSelectedClientType(c.clientType);
                                                    setClientQuery(c.name);
                                                    setClientOptions([]);
                                                    setClientDropdownOpen(false);
                                                    updateQuoteClient(c.id, c.name, c.clientType);
                                                }}
                                            >
                                                <span className="font-medium text-gray-900 truncate">{c.name}</span>
                                                <span className="flex items-center gap-2 shrink-0">
                                                    {typeof c.discountRate === 'number' && c.discountRate > 0 && (
                                                        <span className="text-gray-500">{Math.round(c.discountRate * 100)}% desc.</span>
                                                    )}
                                                    {typeof c.clientType === 'number' && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                                                            Tipo cliente {c.clientType}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {selectedClientId && (
                                    <div className="mt-2 text-xs text-gray-600 flex items-center space-x-2">
                                        <span>Cliente seleccionado ID: {selectedClientId}{selectedClientType ? ` (Tipo ${selectedClientType})` : ''}</span>
                                        <button type="button" className="text-red-600 hover:text-red-800" onClick={() => {
                                            setSelectedClientId(undefined);
                                            setSelectedClientType(undefined);
                                            setClientQuery('');
                                            updateQuoteClient(0, '', undefined);
                                        }}>
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Client indicator for client role users */}
                    {session?.user?.role === 'client' && (
                        <div className="relative">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-blue-900">
                                            Búsqueda para: {session.user.name || 'Cliente'}
                                        </p>
                                        <p className="text-xs text-blue-700">
                                            Los resultados se calcularán con tu tipo de cliente
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            type="submit"
                            disabled={isLoading || isDeepWebSearching || !searchTerm.trim()}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="spinner"></div>
                                    <span>Buscando...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <MagnifyingGlassIcon className="h-4 w-4" />
                                    <span>Buscar</span>
                                </div>
                            )}
                        </button>


                        {(searchTerm || selectedClientId) && (
                            <button type="button" onClick={handleClear} className="btn-secondary" disabled={isLoading || isDeepWebSearching}>
                                Limpiar
                            </button>
                        )}
                    </div>

                    {/* Search Tips */}
                    <div className="text-sm text-gray-500">
                        <p>Tip: Start typing to see suggestions</p>
                    </div>
                </div>

                {/* Manual Reference Section */}
                {searchTerm && !isLoading && (
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                <p>¿No encontró la referencia &quot;{searchTerm}&quot;?</p>
                                <p className="text-xs text-gray-500">Puede agregarla manualmente con un precio personalizado</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowManualReference(!showManualReference)}
                                className="btn-secondary text-sm"
                            >
                                {showManualReference ? 'Cancelar' : 'Agregar Manualmente'}
                            </button>
                        </div>

                        {showManualReference && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="manualDescription" className="block text-sm font-medium text-gray-700">
                                            Nombre del Producto
                                        </label>
                                        <input
                                            type="text"
                                            id="manualDescription"
                                            name="manualDescription"
                                            value={manualDescription}
                                            onChange={(e) => setManualDescription(e.target.value)}
                                            className="input-field mt-1"
                                            placeholder="Ej: Filtro de aceite, Bujía de encendido, etc."
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="manualBrand" className="block text-sm font-medium text-gray-700">
                                                Marca
                                            </label>
                                            <input
                                                type="text"
                                                id="manualBrand"
                                                name="manualBrand"
                                                value={manualBrand}
                                                onChange={(e) => setManualBrand(e.target.value)}
                                                className="input-field mt-1"
                                                placeholder="Ej: Caterpillar, John Deere, etc."
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="manualPrice" className="block text-sm font-medium text-gray-700">
                                                Precio (COP)
                                            </label>
                                            <input
                                                type="number"
                                                id="manualPrice"
                                                name="manualPrice"
                                                value={manualPrice}
                                                onChange={(e) => setManualPrice(Number(e.target.value) || 0)}
                                                className="input-field mt-1"
                                                placeholder="0.00"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={handleAddManualReference}
                                            disabled={manualPrice <= 0}
                                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Agregar a Cotización
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
}
