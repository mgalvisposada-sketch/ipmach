'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SearchSuggestion {
  reference: string;
  label: string;
}

interface SearchResultItem {
  reference: string;
  description?: string;
  quantity: number;
  imageUrl?: string;
  hasStock: boolean;
}

export function IPMachSearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (suggestAbortRef.current) suggestAbortRef.current.abort();
    suggestAbortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/ipmach/search/suggest?q=${encodeURIComponent(value)}`,
        { signal: suggestAbortRef.current.signal }
      );
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setShowSuggestions(true);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setSuggestions([]);
    }
  }, []);

  const handleSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setSearchError(null);
    setResults(null);
    setShowSuggestions(false);

    try {
      const res = await fetch(`/api/ipmach/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Error al buscar');
        setResults([]);
        return;
      }
      setResults(data.data ?? []);
      if (data.timeout) {
        setSearchError('La búsqueda tardó demasiado. Intenta de nuevo.');
      }
    } catch {
      setSearchError('No se pudo conectar con el inventario. Revisa tu conexión.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.length > 2) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-4xl mx-auto">
      {/* Main search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
          <svg
            className="w-7 h-7 text-ipmach-gray-light"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch(query);
          }}
          placeholder="Ingresa Part Number o descripción..."
          className="w-full pl-16 pr-32 py-6 text-lg border-2 border-ipmach-gray-light/30 rounded-2xl focus:border-ipmach-yellow focus:ring-4 focus:ring-ipmach-yellow/20 outline-none transition-all shadow-lg hover:shadow-xl"
        />

        <button
          onClick={() => handleSearch(query)}
          disabled={isSearching || !query.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-ipmach-yellow to-ipmach-yellow-light text-white font-bold hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-lg hover:shadow-xl"
        >
          {isSearching ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Buscando...</span>
            </div>
          ) : (
            <span>Buscar</span>
          )}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-up">
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <p className="text-sm text-ipmach-gray font-medium">Sugerencias</p>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {suggestions.map((s, index) => (
              <li key={`${s.reference}-${index}`}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(s.reference);
                    handleSearch(s.reference);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-6 py-4 hover:bg-ipmach-yellow/10 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-mono font-bold text-ipmach-dark group-hover:text-ipmach-yellow transition-colors block mb-1">
                        {s.reference}
                      </span>
                      <p className="text-sm text-ipmach-gray-light">{s.label}</p>
                    </div>
                    <svg
                      className="w-5 h-5 text-ipmach-gray-light opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick tips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-ipmach-gray-light">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Ejemplos: &quot;1R-0750&quot;, &quot;207-06-71220&quot;, &quot;RE504836&quot;
        </span>
      </div>

      {/* Search results */}
      {results !== null && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {searchError && (
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
              {searchError}
            </div>
          )}
          {results.length === 0 && !searchError && (
            <div className="px-6 py-8 text-center text-ipmach-gray-light">
              No se encontraron resultados para esta búsqueda.
            </div>
          )}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-4 text-sm font-semibold text-ipmach-dark">Imagen</th>
                    <th className="px-6 py-4 text-sm font-semibold text-ipmach-dark">Número de parte</th>
                    <th className="px-6 py-4 text-sm font-semibold text-ipmach-dark">Descripción</th>
                    <th className="px-6 py-4 text-sm font-semibold text-ipmach-dark text-center">Cantidad</th>
                    <th className="px-6 py-4 text-sm font-semibold text-ipmach-dark text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.reference} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt={row.reference}
                            className="h-14 w-14 object-contain rounded border border-slate-200 bg-white"
                          />
                        ) : (
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs text-slate-400">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-ipmach-dark">{row.reference}</td>
                      <td className="px-6 py-4 text-sm text-ipmach-gray-light">{row.description || '—'}</td>
                      <td className="px-6 py-4 text-center">
                        {row.hasStock ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                            {row.quantity} en stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                            {row.quantity}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/ipmach/register?reference=${encodeURIComponent(row.reference)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-ipmach-yellow px-4 py-2.5 text-sm font-bold text-ipmach-dark hover:bg-ipmach-yellow-light transition-colors"
                        >
                          Registrar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
