'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useQuote } from '@/contexts/QuoteContext';

interface ClientSearchFormProps {
    onSearch: (term: string, likeSearch?: boolean) => void;
    isLoading?: boolean;
    isDeepWebSearching?: boolean;
    defaultSearchTerm?: string;
    /** When false, hides the "Búsqueda para: ..." info box. Default true. */
    showClientIndicator?: boolean;
    /** Increment to force clearing the search input (e.g. after results are shown). */
    clearTrigger?: number;
}

interface Suggestion {
    reference: string;
    label: string;
}

export function ClientSearchForm({ onSearch, isLoading = false, isDeepWebSearching = false, defaultSearchTerm = '', showClientIndicator = true, clearTrigger = 0 }: ClientSearchFormProps) {
    const { data: session } = useSession();
    const { updateQuoteClient } = useQuote();
    const [searchTerm, setSearchTerm] = useState(defaultSearchTerm);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const suggestAbortRef = useRef<AbortController | null>(null);
    const containerRef = useRef<HTMLFormElement | null>(null);

    // Sync URL/default search term into field; clearTrigger forces clear when parent signals (e.g. after results)
    useEffect(() => {
        setSearchTerm(defaultSearchTerm ?? '');
    }, [defaultSearchTerm, clearTrigger]);

    // Auto-set client for client role users
    useEffect(() => {
        if (session?.user?.role === 'client' && session?.user?.id) {
            const clientId = parseInt(session.user.id);
            const clientName = session.user.name || 'Cliente';
            updateQuoteClient(clientId, clientName, 2);
        }
    }, [session, updateQuoteClient]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            setShowSuggestions(false);
            // Automatically trigger search (which will trigger deep web search)
            onSearch(searchTerm.trim(), true); // likeSearch = true
        }
    };

    const handlePickSuggestion = (ref: string) => {
        setSearchTerm(ref);
        setShowSuggestions(false);
        // When clicking on a suggestion, perform an exact search
        onSearch(ref, false); // likeSearch = false
    };

    const handleClear = () => {
        setSearchTerm('');
        setSuggestions([]);
        setShowSuggestions(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" ref={containerRef}>
            <div className="grid grid-cols-1 gap-4">
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
                            disabled={isLoading || isDeepWebSearching}
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

                {/* Client indicator - fixed to session user (optional) */}
                {showClientIndicator && (
                    <div className="relative">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-blue-900">
                                        Búsqueda para: {session?.user?.name || 'Cliente'}
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        Los resultados se calcularán con tu tipo de cliente y fuentes configuradas
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
                        {isLoading || isDeepWebSearching ? (
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

                    {searchTerm && (
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
        </form>
    );
}

