'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type CommandBarOrder = { id: number; label: string; href: string };
type CommandBarQuote = { id: number; label: string; href: string };

const DEBOUNCE_MS = 300;

export function GlobalClientSearchBar() {
    const { data: session } = useSession();
    const router = useRouter();
    const [value, setValue] = useState('');
    const [orders, setOrders] = useState<CommandBarOrder[]>([]);
    const [quotes, setQuotes] = useState<CommandBarQuote[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const fetchSuggestions = useCallback(async (q: string) => {
        const trimmed = q.trim();
        if (!trimmed) {
            setOrders([]);
            setQuotes([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/search/command-bar?q=${encodeURIComponent(trimmed)}`);
            if (!res.ok) {
                setOrders([]);
                setQuotes([]);
                return;
            }
            const data = (await res.json()) as {
                orders?: CommandBarOrder[];
                quotes?: CommandBarQuote[];
            };
            setOrders(Array.isArray(data.orders) ? data.orders : []);
            setQuotes(Array.isArray(data.quotes) ? data.quotes : []);
        } catch {
            setOrders([]);
            setQuotes([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            void fetchSuggestions(value);
        }, DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [value, fetchSuggestions]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    if (session?.user?.role !== 'client') {
        return null;
    }

    const showPanel =
        open &&
        value.trim().length > 0 &&
        (loading || orders.length > 0 || quotes.length > 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        setOpen(false);
        router.push(`/client-search?q=${encodeURIComponent(q)}`);
    };

    const navigateTo = (href: string) => {
        setOpen(false);
        router.push(href);
    };

    return (
        <div ref={containerRef} className="relative flex min-w-0 flex-1 max-w-xl items-center">
            <form onSubmit={handleSubmit} className="relative w-full">
                <label htmlFor="global-client-search" className="sr-only">
                    Buscar en el sistema
                </label>
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden />
                </div>
                <input
                    id="global-client-search"
                    type="search"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Buscar referencias, órdenes, cotizaciones…"
                    className="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-ipmach-yellow focus:outline-none focus:ring-1 focus:ring-ipmach-yellow theme-client:border-ipmach-dark/15"
                />
                {showPanel && (
                    <div
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg theme-client:border-ipmach-dark/15"
                        role="listbox"
                    >
                        {loading && (
                            <div className="px-3 py-2 text-xs text-gray-500">Buscando…</div>
                        )}
                        {!loading && orders.length > 0 && (
                            <div className="px-2">
                                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Órdenes
                                </p>
                                <ul className="space-y-0.5">
                                    {orders.map((o) => (
                                        <li key={`o-${o.id}`}>
                                            <button
                                                type="button"
                                                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-ipmach-yellow/15 theme-client:text-ipmach-dark"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => navigateTo(o.href)}
                                            >
                                                {o.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {!loading && quotes.length > 0 && (
                            <div className={`px-2 ${orders.length > 0 ? 'mt-2 border-t border-gray-100 pt-2' : ''}`}>
                                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Cotizaciones
                                </p>
                                <ul className="space-y-0.5">
                                    {quotes.map((qRow) => (
                                        <li key={`q-${qRow.id}`}>
                                            <button
                                                type="button"
                                                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-ipmach-yellow/15 theme-client:text-ipmach-dark"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => navigateTo(qRow.href)}
                                            >
                                                {qRow.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
}
