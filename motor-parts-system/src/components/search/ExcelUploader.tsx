'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface ExcelRow {
    reference: string;
    quantity: number;
}

interface ExcelUploaderProps {
    onProcessStart: () => void;
    onProcessComplete: (references: ExcelRow[]) => void;
    onClearPreview?: () => void;
    clientId?: number;
    clientType?: number;
    isProcessing?: boolean;
}

export default function ExcelUploader({
    onProcessStart,
    onProcessComplete,
    onClearPreview,
    clientId,
    clientType,
    isProcessing = false
}: ExcelUploaderProps) {
    const [preview, setPreview] = useState<ExcelRow[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [allReferences, setAllReferences] = useState<ExcelRow[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevIsProcessingRef = useRef(false);
    const onClearPreviewRef = useRef(onClearPreview);
    onClearPreviewRef.current = onClearPreview;

    const [processingReferenceCount, setProcessingReferenceCount] = useState(0);

    const handleClear = useCallback(() => {
        setPreview([]);
        setAllReferences([]);
        setFileName('');
        setProcessingReferenceCount(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // Reset upload UI when batch finishes (success or error). Avoid clearing mid-request — that hid all loading feedback.
    useEffect(() => {
        if (prevIsProcessingRef.current && !isProcessing) {
            handleClear();
            onClearPreviewRef.current?.();
        }
        prevIsProcessingRef.current = isProcessing;
    }, [isProcessing, handleClear]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!validExtensions.includes(fileExtension)) {
            toast.error('Formato de archivo no válido. Use .xlsx, .xls o .csv');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

            if (jsonData.length === 0) {
                toast.error('El archivo está vacío');
                return;
            }

            // Validate columns
            const firstRow = jsonData[0] as any;
            const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
            
            const hasReference = headers.some(h => 
                h === 'referencia' || h === 'reference' || h === 'ref' || h === 'codigo' || h === 'código'
            );
            const hasQuantity = headers.some(h => 
                h === 'cantidad' || h === 'quantity' || h === 'qty' || h === 'cant'
            );

            if (!hasReference || !hasQuantity) {
                toast.error('El archivo debe tener columnas "Referencia" y "Cantidad"');
                return;
            }

            // Parse references
            const references: ExcelRow[] = [];
            const errors: string[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i] as any;
                
                // Find reference value
                let reference = '';
                for (const key of Object.keys(row)) {
                    const lowerKey = key.toLowerCase().trim();
                    if (lowerKey === 'referencia' || lowerKey === 'reference' || 
                        lowerKey === 'ref' || lowerKey === 'codigo' || lowerKey === 'código') {
                        reference = String(row[key]).trim();
                        break;
                    }
                }

                // Find quantity value
                let quantity = 0;
                for (const key of Object.keys(row)) {
                    const lowerKey = key.toLowerCase().trim();
                    if (lowerKey === 'cantidad' || lowerKey === 'quantity' || 
                        lowerKey === 'qty' || lowerKey === 'cant') {
                        const qtyValue = row[key];
                        quantity = typeof qtyValue === 'number' ? qtyValue : parseInt(String(qtyValue));
                        break;
                    }
                }

                // Validate
                if (!reference) {
                    errors.push(`Fila ${i + 2}: Referencia vacía`);
                    continue;
                }

                if (isNaN(quantity) || quantity < 1) {
                    errors.push(`Fila ${i + 2}: Cantidad inválida (${row.Cantidad || row.cantidad})`);
                    continue;
                }

                references.push({ reference, quantity });
            }

            // Check for errors
            if (errors.length > 0) {
                toast.error(`Se encontraron ${errors.length} errores. Revise el archivo.`, {
                    duration: 5000
                });
                console.error('Excel parsing errors:', errors);
            }

            if (references.length === 0) {
                toast.error('No se encontraron referencias válidas en el archivo');
                return;
            }

            // Limit to 100 references
            if (references.length > 100) {
                toast.error('Máximo 100 referencias permitidas. Se procesarán las primeras 100.');
                const limited = references.slice(0, 100);
                setAllReferences(limited);
                setPreview(limited.slice(0, 10));
                setFileName(file.name);
                return;
            }

            setAllReferences(references);
            setPreview(references.slice(0, 10)); // Show first 10 for preview
            setFileName(file.name);
            toast.success(`${references.length} referencias cargadas correctamente`);

        } catch (error) {
            console.error('Error reading Excel file:', error);
            toast.error('Error al leer el archivo. Verifique el formato.');
        }
    };

    const handleProcess = () => {
        if (allReferences.length === 0) {
            toast.error('No hay referencias para procesar');
            return;
        }

        setProcessingReferenceCount(allReferences.length);
        onProcessStart();
        onProcessComplete(allReferences);
    };

    const handleDownloadTemplate = () => {
        // Create template workbook
        const templateData = [
            { Referencia: 'EJEMPLO-001', Cantidad: 5 },
            { Referencia: 'EJEMPLO-002', Cantidad: 3 },
            { Referencia: 'EJEMPLO-003', Cantidad: 10 }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Referencias');

        // Download
        XLSX.writeFile(wb, 'plantilla_busqueda_masiva.xlsx');
        toast.success('Plantilla descargada');
    };

    return (
        <div className="space-y-4">
            {/* Header with template download */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Búsqueda Masiva desde Excel</h3>
                <button
                    onClick={handleDownloadTemplate}
                    disabled={isProcessing}
                    className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                >
                    Descargar Plantilla
                </button>
            </div>

            {isProcessing && (
                <div
                    role="status"
                    aria-live="polite"
                    className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm"
                >
                    <svg
                        className="h-6 w-6 shrink-0 animate-spin text-amber-700"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-900">Búsqueda en curso</p>
                        <p className="mt-1 text-sm text-amber-800">
                            Procesando {processingReferenceCount} referencia
                            {processingReferenceCount !== 1 ? 's' : ''} en el servidor. Esto puede tardar varios segundos
                            si hay muchas filas; no cierre la página.
                        </p>
                    </div>
                </div>
            )}

            {/* File upload area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                    >
                        <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <div className="mt-4">
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                                Seleccione un archivo Excel
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                                Formatos aceptados: .xlsx, .xls, .csv (máximo 100 referencias)
                            </span>
                            <input
                                ref={fileInputRef}
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileSelect}
                                disabled={isProcessing}
                                className="sr-only"
                            />
                        </label>
                        <p className="mt-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Seleccionar Archivo
                            </button>
                        </p>
                    </div>
                </div>
            </div>

            {/* Preview section */}
            {preview.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900">
                                Vista Previa: {allReferences.length} referencias
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                                Archivo: {fileName}
                            </p>
                        </div>
                        <button
                            onClick={handleClear}
                            disabled={isProcessing}
                            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                            Limpiar
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        #
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        Referencia
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                        Cantidad
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {preview.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-2 text-sm text-gray-500">
                                            {index + 1}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                            {item.reference}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900">
                                            {item.quantity}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {allReferences.length > 10 && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Mostrando las primeras 10 de {allReferences.length} referencias
                        </p>
                    )}

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleProcess}
                            disabled={isProcessing}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                </>
                            ) : (
                                `Procesar ${allReferences.length} Referencia${allReferences.length !== 1 ? 's' : ''}`
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Instrucciones:</h4>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>El archivo debe tener 2 columnas: <strong>Referencia</strong> y <strong>Cantidad</strong></li>
                    <li>Máximo 100 referencias por archivo</li>
                    <li>El sistema buscará automáticamente en todas las fuentes disponibles</li>
                    <li>Los productos encontrados se agregarán directamente al carrito</li>
                    <li>Se mostrará un reporte con referencias no encontradas o con stock insuficiente</li>
                </ul>
            </div>
        </div>
    );
}
