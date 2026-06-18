'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface NotFoundReference {
    reference: string;
    requestedQty: number;
}

interface PartialStockReference {
    reference: string;
    requestedQty: number;
    availableQty: number;
    addedToCart: boolean;
}

interface BatchResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notFoundRefs: NotFoundReference[];
    partialStockRefs: PartialStockReference[];
    onRetrySearch: (originalReference: string, newReference: string) => void;
    onRemove: (reference: string) => void;
}

export default function BatchResultsModal({
    isOpen,
    onClose,
    notFoundRefs,
    partialStockRefs,
    onRetrySearch,
    onRemove
}: BatchResultsModalProps) {
    const [editingRef, setEditingRef] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    if (!isOpen) return null;

    const handleStartEdit = (reference: string) => {
        setEditingRef(reference);
        setEditValue(reference);
    };

    const handleCancelEdit = () => {
        setEditingRef(null);
        setEditValue('');
    };

    const handleSaveEdit = () => {
        if (!editingRef || !editValue.trim()) {
            toast.error('Ingrese una referencia válida');
            return;
        }

        if (editValue.trim() === editingRef) {
            toast.error('La referencia no ha cambiado');
            return;
        }

        onRetrySearch(editingRef, editValue.trim());
        setEditingRef(null);
        setEditValue('');
    };

    const hasProblems = notFoundRefs.length > 0 || partialStockRefs.length > 0;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div 
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                    aria-hidden="true"
                    onClick={onClose}
                ></div>

                {/* Center modal */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                {/* Modal panel */}
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Reporte de Búsqueda Masiva
                                </h3>
                                {hasProblems ? (
                                    <p className="mt-1 text-sm text-gray-500">
                                        Se encontraron algunos problemas que requieren atención
                                    </p>
                                ) : (
                                    <p className="mt-1 text-sm text-green-600">
                                        ¡Todas las referencias fueron encontradas y agregadas correctamente!
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                            >
                                <span className="sr-only">Cerrar</span>
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Not Found Section */}
                            {notFoundRefs.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-red-900 mb-3 flex items-center">
                                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Referencias NO Encontradas ({notFoundRefs.length})
                                    </h4>
                                    <p className="text-xs text-red-700 mb-3">
                                        Las siguientes referencias no fueron encontradas en ninguna fuente. Puede editar la referencia y volver a buscar.
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-red-200">
                                            <thead className="bg-red-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-red-900 uppercase">
                                                        Referencia
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-red-900 uppercase">
                                                        Cantidad Solicitada
                                                    </th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium text-red-900 uppercase">
                                                        Acciones
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-red-100">
                                                {notFoundRefs.map((item) => (
                                                    <tr key={item.reference}>
                                                        <td className="px-3 py-2 text-sm text-gray-900">
                                                            {editingRef === item.reference ? (
                                                                <input
                                                                    type="text"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveEdit();
                                                                        if (e.key === 'Escape') handleCancelEdit();
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span className="font-medium">{item.reference}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-gray-700">
                                                            {item.requestedQty}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-right space-x-2">
                                                            {editingRef === item.reference ? (
                                                                <>
                                                                    <button
                                                                        onClick={handleSaveEdit}
                                                                        className="text-green-600 hover:text-green-800 font-medium"
                                                                    >
                                                                        Guardar
                                                                    </button>
                                                                    <button
                                                                        onClick={handleCancelEdit}
                                                                        className="text-gray-600 hover:text-gray-800"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleStartEdit(item.reference)}
                                                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                                                    >
                                                                        Editar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onRemove(item.reference)}
                                                                        className="text-red-600 hover:text-red-800 font-medium"
                                                                    >
                                                                        Eliminar
                                                                    </button>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Partial Stock Section */}
                            {partialStockRefs.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <h4 className="text-sm font-semibold text-yellow-900 mb-3 flex items-center">
                                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Stock Insuficiente ({partialStockRefs.length})
                                    </h4>
                                    <p className="text-xs text-yellow-700 mb-3">
                                        Las siguientes referencias tienen stock disponible menor al solicitado. Se agregaron las cantidades disponibles al carrito.
                                    </p>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-yellow-200">
                                            <thead className="bg-yellow-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-900 uppercase">
                                                        Referencia
                                                    </th>
                                                    <th className="px-3 py-2 text-center text-xs font-medium text-yellow-900 uppercase">
                                                        Solicitado
                                                    </th>
                                                    <th className="px-3 py-2 text-center text-xs font-medium text-yellow-900 uppercase">
                                                        Disponible
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-900 uppercase">
                                                        Nota
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-yellow-100">
                                                {partialStockRefs.map((item) => (
                                                    <tr key={item.reference}>
                                                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                                            {item.reference}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-center text-gray-700">
                                                            {item.requestedQty}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-center font-semibold text-yellow-700">
                                                            {item.availableQty}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-yellow-700">
                                                            ⚠️ Se agregaron {item.availableQty} de {item.requestedQty} unidades solicitadas
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Success message when no problems */}
                            {!hasProblems && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <svg className="mx-auto h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm font-medium text-green-900">
                                        Todas las referencias fueron encontradas y agregadas al carrito correctamente
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
