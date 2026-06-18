'use client';

import { useState } from 'react';
import { PlusIcon, MinusIcon, ShoppingCartIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';

interface ProductCardProps {
    reference: string;
    description?: string;
    stockQty: number;
    hasStock: boolean;
    priceCOP: number;
    priceCurrency?: 'USD' | 'COP';
    location?: string;
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
    onAddToQuote: (quantity: number) => void;
    onImageClick?: () => void;
    showSource?: boolean; // Hidden for clients
    onEditBeforeAdd?: () => void; // Optional edit button for special cases
    showEditButton?: boolean; // Show edit button (for admins/agents on external products)
    context?: 'quote' | 'order'; // Context for button text (default: 'quote')
}

export function ProductCard({
    reference,
    description,
    stockQty,
    hasStock,
    priceCOP,
    priceCurrency = 'COP',
    location,
    source,
    sourceName,
    imageUrl,
    weight,
    category,
    onAddToQuote,
    onImageClick,
    showSource = true,
    onEditBeforeAdd,
    showEditButton = false,
    context = 'quote'
}: ProductCardProps) {
    const maxQuantity = hasStock && stockQty > 0 ? stockQty : 99999;
    const [quantity, setQuantity] = useState(1);
    const [imageError, setImageError] = useState(false);

    const handleIncrement = () => {
        setQuantity(prev => Math.min(maxQuantity, prev + 1));
    };

    const handleDecrement = () => {
        if (quantity > 1) {
            setQuantity(prev => prev - 1);
        }
    };

    const handleQuantityChange = (value: string) => {
        const num = parseInt(value) || 1;
        setQuantity(Math.max(1, Math.min(maxQuantity, num)));
    };

    const handleAdd = () => {
        onAddToQuote(quantity);
        // Reset quantity after adding
        setQuantity(1);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col md:flex-row items-stretch">
            {/* Sección Izquierda - Imagen */}
            <div className="w-full md:w-40 flex-shrink-0 relative bg-gray-50 flex items-center justify-center overflow-hidden group">
                {imageUrl && !imageError ? (
                    <img
                        src={imageUrl}
                        alt={reference}
                        className="w-full h-32 md:h-full object-contain p-3 cursor-pointer group-hover:scale-105 transition-transform duration-200"
                        onClick={onImageClick}
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 py-8 md:py-12">
                        <PhotoIcon className="h-12 w-12 mb-1" />
                        <span className="text-xs text-center px-2">Sin imagen</span>
                    </div>
                )}
                
                {/* Stock Badge - Top Right */}
                {hasStock ? (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow">
                        {stockQty}
                    </div>
                ) : (
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold shadow">
                        Sin Stock
                    </div>
                )}

                {/* Source Badge - Top Left (only if showSource is true) */}
                {showSource && (
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${
                        source === 'internal' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                    }`}>
                        {sourceName}
                    </div>
                )}
            </div>

            {/* Sección Central - Información del Producto */}
            <div className="flex-1 p-4 min-w-0">
                {/* Reference */}
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={reference}>
                    {reference}
                </h3>

                {/* Category */}
                {category && (
                    <p className="text-xs text-gray-500 mb-2 truncate">
                        {category.category}
                    </p>
                )}

                {/* Description */}
                <p className="text-sm text-gray-600 mb-2 line-clamp-2" title={description}>
                    {description || 'Sin descripción disponible'}
                </p>

                {/* Weight & Location */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {weight && (
                        <span>
                            Peso: {weight.pounds} lbs ({weight.kilograms.toFixed(2)} kg)
                        </span>
                    )}
                    {showSource && location && (
                        <span className="truncate" title={location}>
                            📍 {location}
                        </span>
                    )}
                </div>
            </div>

            {/* Sección Derecha - Precio y Acciones */}
            <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-gray-200 p-4 flex flex-col justify-between bg-gray-50">
                {/* Price */}
                <div className="mb-3">
                    <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(priceCOP, priceCurrency)}
                    </p>
                    {priceCurrency === 'USD' && (
                        <p className="text-xs text-gray-500">Precio en dólares USD</p>
                    )}
                </div>

                {/* Quantity Controls */}
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                        Cantidad
                    </label>
                    <div className="flex items-center justify-between border border-gray-300 rounded-lg overflow-hidden bg-white">
                        <button
                            onClick={handleDecrement}
                            disabled={quantity <= 1}
                            className="flex items-center justify-center w-10 h-10 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Disminuir cantidad"
                        >
                            <MinusIcon className="h-4 w-4 text-gray-600" />
                        </button>
                        
                        <input
                            type="number"
                            min={1}
                            max={maxQuantity}
                            value={quantity}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            className="flex-1 text-center text-base font-semibold border-0 focus:ring-0 focus:outline-none py-2"
                            aria-label="Cantidad"
                        />
                        
                        <button
                            onClick={handleIncrement}
                            disabled={quantity >= maxQuantity}
                            className="flex items-center justify-center w-10 h-10 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Aumentar cantidad"
                        >
                            <PlusIcon className="h-4 w-4 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Add to Quote/Order Button */}
                <button
                    onClick={handleAdd}
                    className={`w-full py-2.5 rounded-lg font-semibold text-white flex items-center justify-center space-x-2 transition-all duration-200 shadow hover:shadow-md ${
                        hasStock
                            ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                            : 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                    }`}
                >
                    <ShoppingCartIcon className="h-4 w-4" />
                    <span className="text-sm">
                        {hasStock
                            ? 'Agregar al carrito'
                            : 'Agregar al carrito (Sin stock)'}
                    </span>
                </button>

                {/* Edit Button - Only show for admins/agents on external products */}
                {showEditButton && onEditBeforeAdd && (
                    <button
                        onClick={onEditBeforeAdd}
                        className="w-full mt-2 py-2 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center space-x-1 transition-all duration-200 border border-gray-300"
                        title="Editar precio y marca antes de agregar"
                    >
                        <span>✏️</span>
                        <span className="text-xs">Editar</span>
                    </button>
                )}
            </div>
        </div>
    );
}
