'use client';

import { useState, useEffect } from 'react';
import { useApiCall } from '@/lib/api-client';
import { toast } from 'react-hot-toast';
import {
    Cog6ToothIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

const CARD_MAX_HEIGHT = 380;
const DEFAULT_DAYS = 90;
const CARD_LIMIT = 20;
const RISK_MIN_SEARCHES = 3;

interface ClientConversionItem {
    id: number;
    username: string;
    email: string;
    clientType: number | null;
    searchAllowed: boolean;
    searchQuotaLimit: number | null;
    totalSearches: number;
    totalOrders: number;
    conversionRate: number;
    lastSearch: string | null;
    lastOrder: string | null;
}

type BehaviorType = 'risk' | 'low' | 'ok';

function getBehavior(c: ClientConversionItem): BehaviorType {
    if (c.totalSearches >= RISK_MIN_SEARCHES && c.totalOrders === 0) return 'risk';
    if (c.totalSearches > 0 && c.totalOrders === 0) return 'low';
    if (c.totalOrders > 0) return 'ok';
    return 'low';
}

export function ClientConversionCard() {
    const apiCall = useApiCall();
    const [list, setList] = useState<ClientConversionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalClient, setModalClient] = useState<ClientConversionItem | null>(null);
    const [modalAllowed, setModalAllowed] = useState(true);
    const [modalQuota, setModalQuota] = useState<string>('');
    const [modalClientType, setModalClientType] = useState<string>('');
    const [saving, setSaving] = useState(false);

    const fetchList = async () => {
        try {
            const res = await apiCall(
                `/api/dashboard/client-conversion?days=${DEFAULT_DAYS}&limit=${CARD_LIMIT}`
            );
            if (res.ok) {
                const data = await res.json();
                setList(data.data ?? []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [apiCall]);

    const openModal = (client: ClientConversionItem) => {
        setModalClient(client);
        setModalAllowed(client.searchAllowed);
        setModalQuota(
            client.searchQuotaLimit === null ? '' : String(client.searchQuotaLimit)
        );
        setModalClientType(
            client.clientType !== null && client.clientType !== undefined
                ? String(client.clientType)
                : ''
        );
    };

    const closeModal = () => {
        setModalClient(null);
        setSaving(false);
    };

    const handleSave = async () => {
        if (!modalClient) return;
        setSaving(true);
        try {
            const body: {
                searchAllowed?: boolean;
                searchQuotaLimit?: number | null;
                clientType?: number | null;
            } = {};
            body.searchAllowed = modalAllowed;
            body.searchQuotaLimit =
                modalQuota.trim() === '' ? null : parseInt(modalQuota, 10);
            if (
                body.searchQuotaLimit !== null &&
                (isNaN(body.searchQuotaLimit) || body.searchQuotaLimit < 0)
            ) {
                toast.error(
                    'Cupo debe ser un número mayor o igual a 0, o vacío para sin límite.'
                );
                setSaving(false);
                return;
            }
            const ct = modalClientType.trim();
            if (ct !== '') {
                const n = parseInt(ct, 10);
                if (!Number.isFinite(n) || n < 0 || n > 99) {
                    toast.error('Tipo de cliente debe ser un número entre 0 y 99.');
                    setSaving(false);
                    return;
                }
                body.clientType = n;
            } else {
                body.clientType = null;
            }
            const res = await apiCall(`/api/users/${modalClient.id}/search-policy`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || 'Error al guardar');
            }
            toast.success('Política y tipo de cliente actualizados');
            closeModal();
            fetchList();
        } catch (e: any) {
            toast.error(e?.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const policyStatusLabel = (c: ClientConversionItem) => {
        if (!c.searchAllowed)
            return { text: 'Bloqueado', className: 'bg-red-100 text-red-800' };
        if (c.searchQuotaLimit != null)
            return { text: 'Limitado', className: 'bg-amber-100 text-amber-800' };
        return { text: 'Activo', className: 'bg-green-100 text-green-800' };
    };

    const behaviorLabel = (c: ClientConversionItem) => {
        const b = getBehavior(c);
        if (b === 'risk')
            return {
                text: 'En riesgo',
                className: 'bg-red-100 text-red-800',
                icon: ExclamationTriangleIcon,
            };
        if (b === 'low')
            return {
                text: 'Bajo',
                className: 'bg-amber-100 text-amber-800',
                icon: ExclamationTriangleIcon,
            };
        return {
            text: 'Convirtiendo',
            className: 'bg-green-100 text-green-800',
            icon: CheckCircleIcon,
        };
    };

    const riskList = list.filter((c) => getBehavior(c) === 'risk');
    const lowList = list.filter((c) => getBehavior(c) === 'low');
    const okList = list.filter((c) => getBehavior(c) === 'ok');

    const renderRow = (c: ClientConversionItem) => {
        const policyStatus = policyStatusLabel(c);
        const behavior = behaviorLabel(c);
        const BehaviorIcon = behavior.icon;
        return (
            <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2 hover:bg-gray-50"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {c.username}
                        </p>
                        {c.clientType !== null && c.clientType !== undefined && (
                            <span className="flex-shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                                Tipo {c.clientType}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {c.totalSearches} búsquedas · {c.totalOrders} órdenes
                        {c.totalSearches > 0 && (
                            <span> · {c.conversionRate}% conv.</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${behavior.className}`}
                        title={
                            behavior.text === 'En riesgo'
                                ? 'Muchas búsquedas sin órdenes'
                                : behavior.text === 'Bajo'
                                  ? 'Pocas o ninguna conversión'
                                  : 'Tiene órdenes'
                        }
                    >
                        <BehaviorIcon className="h-3.5 w-3.5" />
                        {behavior.text}
                    </span>
                    <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${policyStatus.className}`}
                    >
                        {policyStatus.text}
                    </span>
                    <button
                        type="button"
                        onClick={() => openModal(c)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
                    >
                        <Cog6ToothIcon className="h-4 w-4" />
                        Gestionar
                    </button>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">
                        Clientes por conversión
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">Cargando...</p>
                </div>
                <div className="card-body">
                    <div
                        className="space-y-2"
                        style={{ minHeight: CARD_MAX_HEIGHT }}
                    >
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 animate-pulse"
                            >
                                <div className="h-4 w-32 bg-gray-200 rounded" />
                                <div className="h-4 w-16 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h3 className="text-lg font-medium text-gray-900">
                        Clientes por conversión
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                        Quiénes no convierten (en riesgo) vs quiénes sí. Tipo de cliente y política de consultas.
                    </p>
                </div>
                <div
                    className="space-y-2 overflow-y-auto overscroll-contain"
                    style={{ maxHeight: CARD_MAX_HEIGHT }}
                >
                    {list.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">
                            No hay clientes en el período o no hay datos de búsqueda.
                        </p>
                    ) : (
                        <>
                            {riskList.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        En riesgo ({riskList.length}) — consultan y no compran
                                    </h4>
                                    {riskList.map(renderRow)}
                                </div>
                            )}
                            {lowList.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        Baja conversión ({lowList.length})
                                    </h4>
                                    {lowList.map(renderRow)}
                                </div>
                            )}
                            {okList.length > 0 && (
                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1">
                                        <CheckCircleIcon className="h-4 w-4" />
                                        Convirtiendo bien ({okList.length})
                                    </h4>
                                    {okList.map(renderRow)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {modalClient && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="client-policy-modal-title"
                    onClick={closeModal}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <h2
                                id="client-policy-modal-title"
                                className="text-lg font-semibold text-gray-900"
                            >
                                {modalClient.username}
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                                aria-label="Cerrar"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="policy-allowed"
                                    className="text-sm font-medium text-gray-700"
                                >
                                    Permitir consultas
                                </label>
                                <input
                                    id="policy-allowed"
                                    type="checkbox"
                                    checked={modalAllowed}
                                    onChange={(e) =>
                                        setModalAllowed(e.target.checked)
                                    }
                                    className="rounded border-gray-300"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="policy-quota"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    Cupo de consultas (vacío = sin límite)
                                </label>
                                <input
                                    id="policy-quota"
                                    type="number"
                                    min={0}
                                    placeholder="Ej. 100"
                                    value={modalQuota}
                                    onChange={(e) =>
                                        setModalQuota(e.target.value)
                                    }
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Se reinicia cuando el cliente realiza una
                                    orden.
                                </p>
                            </div>
                            <div>
                                <label
                                    htmlFor="policy-client-type"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                    Tipo de cliente (0–99, vacío = sin tipo)
                                </label>
                                <input
                                    id="policy-client-type"
                                    type="number"
                                    min={0}
                                    max={99}
                                    placeholder="Ej. 2, 15, 17"
                                    value={modalClientType}
                                    onChange={(e) =>
                                        setModalClientType(e.target.value)
                                    }
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Afecta precios y listas. Puede cambiarlo según el comportamiento del cliente.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded-lg bg-ipmach-dark text-white py-2 text-sm font-medium hover:bg-ipmach-yellow-dark disabled:opacity-50"
                            >
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
