'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { DocumentTextIcon, ArrowDownTrayIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function ReportsPage() {
    const { data: session } = useSession();
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateReport = async (type: string) => {
        setIsGenerating(true);
        try {
            // Simulate report generation
            await new Promise(resolve => setTimeout(resolve, 2000));
            alert(`¡Reporte "${type}" generado correctamente!`);
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const reportTypes = [
        {
            name: 'Search Analytics Report',
            description: 'Comprehensive report on search patterns and trends',
            icon: DocumentTextIcon,
            type: 'search-analytics',
        },
        {
            name: 'Quote Performance Report',
            description: 'Analysis of quote generation and conversion rates',
            icon: DocumentTextIcon,
            type: 'quote-performance',
        },
        {
            name: 'User Activity Report',
            description: 'User engagement and activity metrics',
            icon: DocumentTextIcon,
            type: 'user-activity',
        },
        {
            name: 'Inventory Report',
            description: 'Stock levels and inventory management insights',
            icon: DocumentTextIcon,
            type: 'inventory',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Genere y descargue reportes del sistema para análisis y registro.
                </p>
            </div>

            {/* Report Generation */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((report) => {
                    const Icon = report.icon;
                    return (
                        <div key={report.type} className="card">
                            <div className="card-body">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <Icon className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <h3 className="text-lg font-medium text-gray-900">{report.name}</h3>
                                        <p className="text-sm text-gray-500">{report.description}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <button
                                        onClick={() => handleGenerateReport(report.name)}
                                        disabled={isGenerating}
                                        className="w-full btn-primary flex items-center justify-center space-x-2"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                        <span>{isGenerating ? 'Generando...' : 'Generar Reporte'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Reports */}
            <div className="card">
                <div className="card-header">
                    <h2 className="text-lg font-medium text-gray-900">Reportes Recientes</h2>
                </div>
                <div className="card-body">
                    <div className="space-y-3">
                        {[
                            {
                                name: 'Reporte de Analítica de Búsquedas - Diciembre 2024',
                                date: '2024-12-15',
                                size: '2.3 MB',
                                type: 'PDF',
                            },
                            {
                                name: 'Reporte de Rendimiento de Cotizaciones - Q4 2024',
                                date: '2024-12-10',
                                size: '1.8 MB',
                                type: 'PDF',
                            },
                            {
                                name: 'Reporte de Actividad de Usuarios - Noviembre 2024',
                                date: '2024-12-05',
                                size: '1.2 MB',
                                type: 'PDF',
                            },
                        ].map((report, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{report.name}</p>
                                        <p className="text-xs text-gray-500">
                                            Generado el {report.date} • {report.size} • {report.type}
                                        </p>
                                    </div>
                                </div>
                                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                    Descargar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
