'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentTextIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PORTFOLIO_OVERDUE_GRACE_DAYS } from '@/lib/portfolio-credit-terms';

interface BillingDocument {
  id: string;
  externalId?: number;
  type?: string;
  total: number;
  paid: number;
  pending: number;
  freg?: string;
}

interface BillingClientData {
  pendingAmount: number;
  unpaidDocumentsCount: number;
  lastPayments?: unknown[];
  totalPaid?: number;
  lastDocumentDate?: string | null;
  documents?: BillingDocument[];
}

interface BillingResponse {
  success?: boolean;
  data?: {
    billingByClientId?: Record<string, BillingClientData>;
  };
}

/** Matches pending order rows from GET /api/credit/summary. */
export interface PlatformOpenOrderRow {
  id: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  orderName: string | null;
  paymentStatus: string;
}

interface PendingDebtDetailProps {
  isOpen: boolean;
  onClose: () => void;
  isClientTheme?: boolean;
  /** When set (e.g. from credit summary), show due date and overdue status per document. */
  paymentTermDays?: number | null;
  /** Open platform orders (pending/processing); shown below external documents in the modal. */
  platformOpenOrders?: PlatformOpenOrderRow[];
}

const PENDING_EPSILON = 0.005;

function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDocDayStartMs(freg: string): number | null {
  const d = new Date(freg);
  if (Number.isNaN(d.getTime())) return null;
  return utcDayStartMs(d);
}

function docPortfolioStatus(
  doc: BillingDocument,
  paymentTermDays: number,
  now: Date
): { dueLabel: string; statusLabel: string } {
  const pending = typeof doc.pending === 'number' ? doc.pending : 0;
  if (pending <= PENDING_EPSILON || !doc.freg) {
    return { dueLabel: '—', statusLabel: '—' };
  }
  const issueMs = parseDocDayStartMs(doc.freg);
  if (issueMs == null) return { dueLabel: '—', statusLabel: '—' };
  const dueMs = issueMs + paymentTermDays * 86_400_000;
  const dueDate = new Date(dueMs);
  const todayMs = utcDayStartMs(now);
  const daysPastDue = Math.floor((todayMs - dueMs) / 86_400_000);
  const dueLabel = formatDate(dueDate.toISOString());
  if (daysPastDue <= 0) {
    return { dueLabel, statusLabel: 'Al día' };
  }
  if (daysPastDue > PORTFOLIO_OVERDUE_GRACE_DAYS) {
    return { dueLabel, statusLabel: `Mora (${daysPastDue} d.) — bloquea órdenes` };
  }
  return { dueLabel, statusLabel: `Mora (${daysPastDue} d.)` };
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'processing':
      return 'En proceso';
    default:
      return status;
  }
}

export function PendingDebtDetail({
  isOpen,
  onClose,
  isClientTheme,
  paymentTermDays,
  platformOpenOrders = [],
}: PendingDebtDetailProps) {
  const [data, setData] = useState<BillingClientData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setData(null);
    setIsLoading(true);
    fetch('/api/billing/pending?detail=documents')
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body?.error || res.statusText);
          });
        }
        return res.json();
      })
      .then((body: BillingResponse) => {
        const billing = body?.data?.billingByClientId;
        if (!billing || typeof billing !== 'object') {
          setData(null);
          return;
        }
        const keys = Object.keys(billing);
        const firstKey = keys[0];
        if (firstKey) {
          setData(billing[firstKey]);
        } else {
          setData(null);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle');
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const documents = data?.documents ?? [];
  const term =
    typeof paymentTermDays === 'number' && Number.isFinite(paymentTermDays) && paymentTermDays > 0
      ? paymentTermDays
      : null;
  const now = new Date();
  const theme = isClientTheme
    ? {
        bg: 'bg-white',
        title: 'text-ipmach-dark',
        border: 'border-ipmach-dark/10',
        button: 'bg-ipmach-yellow text-ipmach-dark hover:bg-ipmach-yellow/90',
      }
    : {
        bg: 'bg-white',
        title: 'text-gray-900',
        border: 'border-gray-200',
        button: 'bg-blue-600 text-white hover:bg-blue-700',
      };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500/75 transition-opacity" />
        </Transition.Child>
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <Dialog.Panel
                className={`relative ${theme.bg} rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col border ${theme.border}`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <Dialog.Title className={`text-lg font-semibold ${theme.title}`}>
                    Deuda general – Detalle
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <span className="sr-only">Cerrar</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {isLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-blue-600" />
                    </div>
                  )}
                  {error && (
                    <p className="text-sm text-red-600 py-4">{error}</p>
                  )}
                  {!isLoading && !error && (
                    <>
                      {data !== null ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div className="rounded-lg border border-gray-200 p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Pendiente</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(data.pendingAmount ?? 0, 'USD')}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 p-3">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Documentos sin pagar</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {data.unpaidDocumentsCount ?? 0}
                              </p>
                            </div>
                            {typeof data.totalPaid === 'number' && (
                              <div className="rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Total pagado</p>
                                <p className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(data.totalPaid, 'USD')}
                                </p>
                              </div>
                            )}
                            {data.lastDocumentDate && (
                              <div className="rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Último documento</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {formatDate(data.lastDocumentDate)}
                                </p>
                              </div>
                            )}
                          </div>
                          {documents.length > 0 ? (
                            <div>
                              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <DocumentTextIcon className="h-4 w-4" />
                                Documentos pendientes
                              </h3>
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID / Ref</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha doc.</th>
                                      {term != null && (
                                        <>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimiento</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cartera</th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 bg-white">
                                    {documents.map((doc) => {
                                      const rowStatus = term != null ? docPortfolioStatus(doc, term, now) : null;
                                      return (
                                        <tr key={doc.id}>
                                          <td className="px-3 py-2 text-sm text-gray-900">
                                            {doc.externalId != null ? String(doc.externalId) : doc.id}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-600">{doc.type ?? '—'}</td>
                                          <td className="px-3 py-2 text-sm text-right text-gray-900">
                                            {formatCurrency(doc.total, 'USD')}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-right text-gray-600">
                                            {formatCurrency(doc.paid, 'USD')}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">
                                            {formatCurrency(doc.pending, 'USD')}
                                          </td>
                                          <td className="px-3 py-2 text-sm text-gray-600">
                                            {doc.freg ? formatDate(doc.freg) : '—'}
                                          </td>
                                          {term != null && rowStatus && (
                                            <>
                                              <td className="px-3 py-2 text-sm text-gray-600">{rowStatus.dueLabel}</td>
                                              <td className="px-3 py-2 text-sm text-gray-700">{rowStatus.statusLabel}</td>
                                            </>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 py-4">Sin documentos pendientes.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 py-4">Sin datos de deuda.</p>
                      )}
                      <div className="mt-8 border-t border-gray-200 pt-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <ClipboardDocumentListIcon className="h-4 w-4" aria-hidden />
                          Órdenes en plataforma
                        </h3>
                        <p className="text-xs text-gray-500 mb-3">
                          Pedidos en estado Pendiente o En proceso que consumen cupo (no forman parte del saldo de
                          documentos externos).
                        </p>
                        {platformOpenOrders.length > 0 ? (
                          <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Orden</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Nombre</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Fecha</th>
                                  <th className="px-3 py-2 text-left font-medium text-gray-500">Estado</th>
                                  <th className="px-3 py-2 text-right font-medium text-gray-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {platformOpenOrders.map((o) => (
                                  <tr key={o.id}>
                                    <td className="px-3 py-2">
                                      <Link
                                        href="/orders"
                                        className="font-medium text-blue-600 hover:underline"
                                      >
                                        #{o.id}
                                      </Link>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">{o.orderName || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {new Date(o.createdAt).toLocaleDateString('es', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </td>
                                    <td className="px-3 py-2">{orderStatusLabel(o.status)}</td>
                                    <td className="px-3 py-2 text-right font-medium">
                                      {formatCurrency(o.totalAmount, 'USD')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No hay órdenes pendientes o en proceso.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end px-4 py-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${theme.button}`}
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
