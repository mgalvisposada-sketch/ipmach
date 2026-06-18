'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

const QUOTE_STORAGE_BASE = 'motor-parts-quote';
const QUOTE_MODE_STORAGE_BASE = 'motor-parts-quote-mode';
const QUOTE_EDIT_ID_STORAGE_BASE = 'motor-parts-quote-edit-id';
const LEGACY_QUOTE_KEY = 'motor-parts-quote';
const LEGACY_MODE_KEY = 'motor-parts-quote-mode';
const LEGACY_EDIT_ID_KEY = 'motor-parts-quote-edit-id';

export interface QuoteItem {
    id: string; // Unique identifier for each item instance
    reference: string;
    stockQty: number;
    basePriceCOP: number;
    clientPriceCOP?: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    source?: 'internal' | 'third-party'; // Source of the item
    sourceName?: string; // Name of the third-party provider
    origin?: string; // Origin code (e.g., 'agrocosta', 'gecolsa') - hidden from clients
    brand?: string; // Brand name for external references
    /** Unit weight in pounds (e.g. Costex), for Miami carrier surcharge. */
    weightPoundsPerUnit?: number;
}

export interface Quote {
    id: string;
    items: QuoteItem[];
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
    clientId?: number;
    clientName?: string;
    clientType?: number;
    agentId?: number;
}

interface QuoteContextType {
    currentQuote: Quote | null;
    quoteMode: 'creating' | 'editing' | null;
    addItemToQuote: (item: Omit<QuoteItem, 'id' | 'quantity' | 'unitPrice' | 'totalPrice'>, quantity?: number) => void;
    updateItemQuantity: (itemId: string, quantity: number) => void;
    updateItemPrice: (itemId: string, price: number) => void;
    updateQuoteClient: (clientId: number, clientName: string, clientType?: number) => void;
    removeItemFromQuote: (itemId: string) => void;
    clearQuote: () => void;
    createNewQuote: () => void;
    getQuoteItemCount: () => number;
    getQuoteTotal: () => number;
    debugLocalStorage: () => void;
    forceSaveToLocalStorage: () => void;
    loadQuote: (quote: Partial<Quote> & { items: any[] }) => void;
    getEditingQuoteId: () => string | null;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

function parseAndNormalizeQuote(savedQuote: string): Quote | null {
    try {
        const parsedQuote = JSON.parse(savedQuote);
        parsedQuote.createdAt = new Date(parsedQuote.createdAt);
        parsedQuote.updatedAt = new Date(parsedQuote.updatedAt);
        parsedQuote.items = (parsedQuote.items || []).map((item: any) => {
            const unitPrice = item.clientPriceCOP || item.basePriceCOP || 0;
            const quantity = item.quantity || 1;
            const totalPrice = unitPrice * quantity;
            return {
                ...item,
                id: item.id || `${item.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                unitPrice,
                totalPrice,
            };
        });
        parsedQuote.totalAmount = parsedQuote.items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
        return parsedQuote as Quote;
    } catch {
        return null;
    }
}

export function QuoteProvider({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const userId = session?.user?.id ?? null;

    const quoteStorageKey = userId ? `${QUOTE_STORAGE_BASE}-${userId}` : null;
    const quoteModeStorageKey = userId ? `${QUOTE_MODE_STORAGE_BASE}-${userId}` : null;
    const quoteEditIdStorageKey = userId ? `${QUOTE_EDIT_ID_STORAGE_BASE}-${userId}` : null;

    const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
    const [quoteMode, setQuoteMode] = useState<'creating' | 'editing' | null>(null);
    const isInitialLoad = useRef(true);

    // When userId changes: clear in-memory state and load from this user's key (or migrate legacy once)
    useEffect(() => {
        if (userId == null) {
            setCurrentQuote(null);
            setQuoteMode(null);
            return;
        }

        const quoteKey = `${QUOTE_STORAGE_BASE}-${userId}`;
        const modeKey = `${QUOTE_MODE_STORAGE_BASE}-${userId}`;

        setCurrentQuote(null);
        setQuoteMode(null);

        let savedQuote = localStorage.getItem(quoteKey);
        let savedMode = localStorage.getItem(modeKey) as 'creating' | 'editing' | null;

        if (!savedQuote && isInitialLoad.current) {
            const legacyQuote = localStorage.getItem(LEGACY_QUOTE_KEY);
            if (legacyQuote) {
                localStorage.setItem(quoteKey, legacyQuote);
                localStorage.removeItem(LEGACY_QUOTE_KEY);
                savedQuote = legacyQuote;
            }
            const legacyMode = localStorage.getItem(LEGACY_MODE_KEY);
            if (legacyMode === 'creating' || legacyMode === 'editing') {
                localStorage.setItem(modeKey, legacyMode);
                localStorage.removeItem(LEGACY_MODE_KEY);
                savedMode = legacyMode as 'creating' | 'editing';
            }
            const legacyEditId = localStorage.getItem(LEGACY_EDIT_ID_KEY);
            if (legacyEditId && quoteEditIdStorageKey) {
                localStorage.setItem(quoteEditIdStorageKey, legacyEditId);
                localStorage.removeItem(LEGACY_EDIT_ID_KEY);
            }
            isInitialLoad.current = false;
        }

        if (savedQuote) {
            const parsed = parseAndNormalizeQuote(savedQuote);
            if (parsed) setCurrentQuote(parsed);
            else localStorage.removeItem(quoteKey);
        }
        if (savedMode === 'creating' || savedMode === 'editing') {
            setQuoteMode(savedMode);
        }
    }, [userId, quoteEditIdStorageKey]);

    // Save quote to this user's key when quote or userId changes
    useEffect(() => {
        if (quoteStorageKey == null) return;
        if (currentQuote) {
            localStorage.setItem(quoteStorageKey, JSON.stringify(currentQuote));
        } else {
            localStorage.removeItem(quoteStorageKey);
        }
    }, [currentQuote, quoteStorageKey]);

    // Save quote mode to this user's key
    useEffect(() => {
        if (quoteModeStorageKey == null) return;
        if (quoteMode === 'creating' || quoteMode === 'editing') {
            localStorage.setItem(quoteModeStorageKey, quoteMode);
        } else {
            localStorage.removeItem(quoteModeStorageKey);
        }
    }, [quoteMode, quoteModeStorageKey]);

    const createNewQuote = () => {
        const newQuote: Quote = {
            id: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
            items: [],
            totalAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        setCurrentQuote(newQuote);
        setQuoteMode('creating');

        if (quoteEditIdStorageKey) localStorage.removeItem(quoteEditIdStorageKey);
        if (quoteModeStorageKey) localStorage.setItem(quoteModeStorageKey, 'creating');

        toast.success('Nueva cotización creada');
    };

    const addItemToQuote = (item: Omit<QuoteItem, 'id' | 'quantity' | 'unitPrice' | 'totalPrice'>, quantity: number = 1) => {
        console.log('Adding item to quote:', item);

        // Always add as new item (allow multiple instances of same product)
        const unitPrice = item.clientPriceCOP || item.basePriceCOP || 0;
        const finalQuantity = Math.max(1, quantity); // Usar la cantidad recibida, minimo 1
        const totalPrice = unitPrice * finalQuantity;

        const newItem: QuoteItem = {
            ...item,
            id: `${item.reference}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            quantity: finalQuantity,
            unitPrice,
            totalPrice,
        };

        console.log('New item to add:', newItem);

        setCurrentQuote(prevQuote => {
            console.log('Previous quote state:', prevQuote);

            // Create new quote if none exists
            if (!prevQuote) {
                let preservedClientInfo: { clientId?: number; clientName?: string; clientType?: number } = {};
                const keyToRead = quoteStorageKey ?? LEGACY_QUOTE_KEY;
                try {
                    const savedQuote = localStorage.getItem(keyToRead);
                    if (savedQuote) {
                        const parsed = JSON.parse(savedQuote);
                        if (parsed.clientId && parsed.clientName) {
                            preservedClientInfo = {
                                clientId: parsed.clientId,
                                clientName: parsed.clientName,
                                clientType: parsed.clientType,
                            };
                        }
                    }
                } catch {
                    // Ignore localStorage errors
                }

                const newQuote = {
                    id: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
                    items: [newItem],
                    totalAmount: totalPrice,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...preservedClientInfo,
                };
                console.log('Created new quote with first item:', newQuote);
                return newQuote;
            }

            // Add item to existing quote - preserve client information
            // Add new item at the top (beginning) of the list
            const updatedItems = [newItem, ...prevQuote.items];
            const updatedQuote = {
                ...prevQuote,
                items: updatedItems,
                totalAmount: updatedItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
                updatedAt: new Date(),
                // Preserve client information if it exists
                clientId: prevQuote.clientId,
                clientName: prevQuote.clientName,
                clientType: prevQuote.clientType,
            };

            console.log('Updated quote with new item:', updatedQuote);
            console.log('Total items in quote:', updatedQuote.items.length);

            return updatedQuote;
        });

        // Show toast notification AFTER state update (outside setState callback)
        if (!item.hasStock) {
            toast.success(`${item.reference} agregado a la cotización (Sin stock)`, {
                icon: '⚠️',
                duration: 4000,
            });
        } else {
            toast.success(`${item.reference} agregado a la cotización`);
        }

        // Update quote mode AFTER state update
        setQuoteMode(prev => prev || 'creating');
    };

    const updateItemQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItemFromQuote(itemId);
            return;
        }

        setCurrentQuote(prevQuote => {
            if (!prevQuote) return prevQuote;

            const itemIndex = prevQuote.items.findIndex(item => item.id === itemId);
            if (itemIndex === -1) return prevQuote;

            const updatedQuote = { ...prevQuote };
            const item = updatedQuote.items[itemIndex];

            updatedQuote.items[itemIndex] = {
                ...item,
                quantity,
                totalPrice: item.unitPrice * quantity,
            };

            // Recalculate total
            updatedQuote.totalAmount = updatedQuote.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            updatedQuote.updatedAt = new Date();

            return updatedQuote;
        });
    };

    const updateItemPrice = (itemId: string, price: number) => {
        if (price < 0) return;

        setCurrentQuote(prevQuote => {
            if (!prevQuote) return prevQuote;

            const itemIndex = prevQuote.items.findIndex(item => item.id === itemId);
            if (itemIndex === -1) return prevQuote;

            const updatedQuote = { ...prevQuote };
            const item = updatedQuote.items[itemIndex];

            updatedQuote.items[itemIndex] = {
                ...item,
                unitPrice: price,
                basePriceCOP: price,
                clientPriceCOP: price, // For manual items, use the same price
                totalPrice: price * item.quantity,
            };

            // Recalculate total
            updatedQuote.totalAmount = updatedQuote.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            updatedQuote.updatedAt = new Date();

            return updatedQuote;
        });
    };

    const updateQuoteClient = (clientId: number, clientName: string, clientType?: number) => {
        setCurrentQuote(prevQuote => {
            // Skip update if client info hasn't changed (prevent infinite loops)
            if (prevQuote && 
                prevQuote.clientId === clientId && 
                prevQuote.clientName === clientName && 
                prevQuote.clientType === clientType) {
                return prevQuote; // No change needed
            }

            if (!prevQuote) {
                // Create a new quote if none exists
                const newQuote: Quote = {
                    id: `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
                    items: [],
                    totalAmount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    clientId,
                    clientName,
                    clientType,
                };
                return newQuote;
            }

            // Update existing quote
            const updatedQuote = {
                ...prevQuote,
                clientId,
                clientName,
                clientType,
                updatedAt: new Date(),
            };

            return updatedQuote;
        });

        // Update quote mode outside of setState
        setQuoteMode(prev => prev || 'creating');
    };

    const removeItemFromQuote = (itemId: string) => {
        console.log('removeItemFromQuote called with itemId:', itemId);

        setCurrentQuote(prevQuote => {
            console.log('Previous quote before removal:', prevQuote);

            if (!prevQuote) {
                console.log('No previous quote to remove from');
                return prevQuote;
            }

            const updatedQuote = {
                ...prevQuote,
                items: prevQuote.items.filter(item => item.id !== itemId),
                updatedAt: new Date(),
            };

            // Recalculate total
            updatedQuote.totalAmount = updatedQuote.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

            console.log('Updated quote after removal:', updatedQuote);

            // Clear quote if no items left
            if (updatedQuote.items.length === 0) {
                console.log('No items left, clearing quote');
                return null;
            }

            return updatedQuote;
        });

        toast.success('Ítem removido de la cotización');
    };

    const clearQuote = () => {
        setCurrentQuote(null);
        setQuoteMode(null);
        if (quoteStorageKey) localStorage.removeItem(quoteStorageKey);
        if (quoteModeStorageKey) localStorage.removeItem(quoteModeStorageKey);
        if (quoteEditIdStorageKey) localStorage.removeItem(quoteEditIdStorageKey);
        toast.success('Cotización limpiada');
    };

    const getQuoteItemCount = () => {
        return currentQuote?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
    };

    const getQuoteTotal = () => {
        return currentQuote?.totalAmount || 0;
    };

    const debugLocalStorage = () => {
        const key = quoteStorageKey ?? LEGACY_QUOTE_KEY;
        const saved = localStorage.getItem(key);
        console.log('Current localStorage key:', key);
        console.log('Current localStorage data:', saved);
        console.log('Current quote state:', currentQuote);
        console.log('Parsed localStorage:', saved ? JSON.parse(saved) : null);
    };

    const forceSaveToLocalStorage = () => {
        if (currentQuote && quoteStorageKey) {
            localStorage.setItem(quoteStorageKey, JSON.stringify(currentQuote));
        }
    };

    /**
     * Replace current quote with a provided quote-like object (e.g., from API),
     * mapping items to the expected structure and recalculating totals.
     */
    const loadQuote = (incoming: Partial<Quote> & { items: any[] }) => {
        try {
            const mappedItems: QuoteItem[] = (incoming.items || []).map((raw: any) => {
                const quantity = typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : 1;
                const unitPrice = typeof raw.unitPrice === 'number' ? raw.unitPrice : (typeof raw.basePriceCOP === 'number' ? raw.basePriceCOP : 0);
                const totalPrice = typeof raw.totalPrice === 'number' ? raw.totalPrice : unitPrice * quantity;

                return {
                    id: raw.id || `${raw.reference || 'ITEM'}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    reference: raw.reference || raw.ref || 'UNKNOWN',
                    stockQty: typeof raw.stockQty === 'number' ? raw.stockQty : 0,
                    basePriceCOP: typeof raw.basePriceCOP === 'number' ? raw.basePriceCOP : unitPrice,
                    clientPriceCOP: typeof raw.clientPriceCOP === 'number' ? raw.clientPriceCOP : undefined,
                    hasStock: typeof raw.hasStock === 'boolean' ? raw.hasStock : true,
                    location: raw.location,
                    description: raw.description,
                    quantity,
                    unitPrice,
                    totalPrice,
                    source: raw.source === 'third-party' ? 'third-party' : 'internal',
                    sourceName: raw.sourceName,
                };
            });

            const totalAmount = mappedItems.reduce((sum, it) => sum + (typeof it.totalPrice === 'number' ? it.totalPrice : 0), 0);

            const loaded: Quote = {
                id: (incoming.id as string) || `Q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
                items: mappedItems,
                totalAmount,
                createdAt: incoming.createdAt instanceof Date ? incoming.createdAt : new Date(),
                updatedAt: new Date(),
                clientId: incoming.clientId,
                clientName: incoming.clientName,
                clientType: incoming.clientType,
                agentId: incoming.agentId,
            };

            setCurrentQuote(loaded);
            setQuoteMode('editing');

            if (quoteModeStorageKey) localStorage.setItem(quoteModeStorageKey, 'editing');
            if (incoming.id && quoteEditIdStorageKey) {
                localStorage.setItem(quoteEditIdStorageKey, String(incoming.id));
            }

            toast.success('Cotización cargada');
        } catch (e) {
            console.error('Failed to load quote:', e);
            toast.error('No se pudo cargar la cotización');
        }
    };

    const getEditingQuoteId = () => {
        if (typeof window === 'undefined' || !quoteEditIdStorageKey) return null;
        return localStorage.getItem(quoteEditIdStorageKey);
    };

    const value: QuoteContextType = {
        currentQuote,
        quoteMode,
        addItemToQuote,
        updateItemQuantity,
        updateItemPrice,
        updateQuoteClient,
        removeItemFromQuote,
        clearQuote,
        createNewQuote,
        getQuoteItemCount,
        getQuoteTotal,
        debugLocalStorage,
        forceSaveToLocalStorage,
        loadQuote,
        getEditingQuoteId,
    };

    return (
        <QuoteContext.Provider value={value}>
            {children}
        </QuoteContext.Provider>
    );
}

export function useQuote() {
    const context = useContext(QuoteContext);
    if (context === undefined) {
        throw new Error('useQuote must be used within a QuoteProvider');
    }
    return context;
}
