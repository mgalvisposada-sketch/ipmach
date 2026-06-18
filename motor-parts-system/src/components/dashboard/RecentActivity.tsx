'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useApiCall } from '@/lib/api-client';
import { useSession } from 'next-auth/react';
import {
    MagnifyingGlassIcon,
    DocumentTextIcon,
    ShoppingBagIcon,
    ArrowTopRightOnSquareIcon,
    Squares2X2Icon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

const CARD_VISIBLE_ITEMS = 5;
const CARD_MAX_HEIGHT = 320;
const API_LIMIT = 15;

interface Activity {
    id: string;
    type: 'search' | 'quote' | 'order';
    message: string;
    timestamp: string | Date;
    user: string;
    status?: 'success' | 'warning' | 'error';
    action?: { label: string; href: string };
}

const TYPE_LABEL: Record<Activity['type'], string> = {
    search: 'Búsqueda',
    quote: 'Cotización',
    order: 'Pedido',
};

function getActivityIcon(type: Activity['type']) {
    switch (type) {
        case 'search':
            return MagnifyingGlassIcon;
        case 'quote':
            return DocumentTextIcon;
        case 'order':
            return ShoppingBagIcon;
        default:
            return DocumentTextIcon;
    }
}

function getTypeStyles(type: Activity['type']) {
    switch (type) {
        case 'search':
            return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
        case 'quote':
            return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
        case 'order':
            return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
        default:
            return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
}

function formatTime(timestamp: string | Date) {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '—';
        return formatDistanceToNow(date, { addSuffix: true, locale: es });
    } catch {
        return '—';
    }
}

function ActivityRow({
    activity,
    showUser,
}: {
    activity: Activity;
    showUser: boolean;
}) {
    const Icon = getActivityIcon(activity.type);
    const typeStyles = getTypeStyles(activity.type);
    return (
        <div
            className={`flex items-start gap-3 rounded-lg border ${typeStyles.border} ${typeStyles.bg} p-3 transition-shadow hover:shadow-sm`}
        >
            <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-white border border-gray-100">
                <Icon className={`h-5 w-5 ${typeStyles.text}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${typeStyles.text} ${typeStyles.bg}`}
                    >
                        {TYPE_LABEL[activity.type]}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300" aria-hidden />
                    <span className="text-xs text-gray-500">{formatTime(activity.timestamp)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-900 leading-snug">{activity.message}</p>
                {showUser && activity.user && (
                    <p className="mt-0.5 text-xs text-gray-500">Por {activity.user}</p>
                )}
            </div>
            {activity.action && (
                <div className="flex-shrink-0">
                    <Link
                        href={activity.action.href}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-ipmach-dark transition-colors"
                    >
                        {activity.action.label}
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    </Link>
                </div>
            )}
        </div>
    );
}

export function RecentActivity() {
    const { data: session } = useSession();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const apiCall = useApiCall();

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await apiCall(`/api/dashboard/activity?limit=${API_LIMIT}`);
                if (response.ok) {
                    const result = await response.json();
                    setActivities(result.data ?? []);
                }
            } catch (error) {
                console.error('Error fetching activities:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchActivities();
    }, [apiCall]);

    const isAdmin = session?.user?.role === 'admin';
    const isClient = session?.user?.role === 'client';
    const showUser = !isClient;
    const hasMore = activities.length > CARD_VISIBLE_ITEMS;
    const visibleInCard = hasMore ? activities.slice(0, CARD_VISIBLE_ITEMS) : activities;

    if (isLoading) {
        return (
            <div className="space-y-3" style={{ minHeight: CARD_MAX_HEIGHT }}>
                {[...Array(5)].map((_, index) => (
                    <div key={index} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                        <div className="h-9 w-9 rounded-lg bg-gray-200 animate-pulse" />
                        <div className="flex-1 space-y-2 min-w-0">
                            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                            <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-10 rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-700">No hay actividad reciente</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">
                    Las búsquedas, cotizaciones y pedidos recientes aparecerán aquí para que puedas revisarlos y actuar.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">
                    {isAdmin
                        ? 'Últimas búsquedas, cotizaciones y pedidos del sistema. Usa los enlaces para revisar o actuar.'
                        : isClient
                          ? 'Tu actividad reciente. Haz clic en "Buscar de nuevo" para repetir una búsqueda.'
                          : 'Tu actividad reciente. Revisa cotizaciones o búsquedas desde aquí.'}
                </p>
                <div
                    className="space-y-2 overflow-y-auto overscroll-contain"
                    style={{ maxHeight: CARD_MAX_HEIGHT }}
                    aria-label="Lista de actividad reciente"
                >
                    {visibleInCard.map((activity) => (
                        <ActivityRow key={activity.id} activity={activity} showUser={showUser} />
                    ))}
                </div>
                {hasMore && (
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                    >
                        <Squares2X2Icon className="h-5 w-5" />
                        Ver toda la actividad ({activities.length})
                    </button>
                )}
            </div>

            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="activity-modal-title"
                    onClick={() => setModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-gray-200">
                            <h2 id="activity-modal-title" className="text-lg font-semibold text-gray-900">
                                Toda la actividad reciente
                            </h2>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                aria-label="Cerrar"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-2">
                            {activities.map((activity) => (
                                <ActivityRow key={activity.id} activity={activity} showUser={showUser} />
                            ))}
                        </div>
                        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="w-full rounded-lg bg-gray-200 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
