'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { SearchMonitoring } from '@/components/dashboard/SearchMonitoring';
import { QuoteOversight } from '@/components/dashboard/QuoteOversight';
import { PerformanceMetrics } from '@/components/dashboard/PerformanceMetrics';

export default function AdminDashboardPage() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState<'search' | 'quotes' | 'performance'>('search');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if user has admin access
        if (session?.user?.role !== 'admin') {
            toast.error('Acceso denegado. Se requieren privilegios de administrador.');
            return;
        }

        setIsLoading(false);
    }, [session]);

    const tabs = [
        {
            id: 'search',
            name: 'Monitoreo de Búsquedas',
            description: 'Monitoree actividad y patrones de búsqueda',
        },
        {
            id: 'quotes',
            name: 'Supervisión de Cotizaciones',
            description: 'Seguimiento del estado y rendimiento de cotizaciones',
        },
        {
            id: 'performance',
            name: 'Métricas de Rendimiento',
            description: 'Inteligencia de negocio y KPIs',
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (session?.user?.role !== 'admin') {
        return (
            <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Acceso denegado</h3>
                <p className="mt-1 text-sm text-gray-500">
                    No tiene permiso para acceder al panel de administración.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Supervisión completa del seguimiento de búsquedas y gestión de cotizaciones.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'search' && <SearchMonitoring />}
                {activeTab === 'quotes' && <QuoteOversight />}
                {activeTab === 'performance' && <PerformanceMetrics />}
            </div>
        </div>
    );
}
