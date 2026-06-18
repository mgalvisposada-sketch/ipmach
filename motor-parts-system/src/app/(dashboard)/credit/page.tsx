'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  BanknotesIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';
import { PendingDebtDetail } from '@/components/billing/PendingDebtDetail';
import { SUPPORT_WHATSAPP_HREF } from '@/lib/support-links';

type PendingOrderRow = {
  id: number;
  totalAmount: number;
  status: string;
  createdAt: string;
  orderName: string | null;
  paymentStatus: string;
};

type CreditSummary = {
  hasCredit: boolean;
  creditLimit: number | null;
  /** Filipo `credit_days_limit` */
  creditDaysLimit?: number | null;
  creditPaymentTermDays?: number | null;
  portfolioBlocked?: boolean;
  portfolioBlockMessage?: string | null;
  portfolioOverdueCount?: number;
  portfolioOverdueGraceDays?: number;
  externalDebt: number;
  pendingOrdersSum: number;
  availableCredit: number;
  pendingOrders: PendingOrderRow[];
};

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'processing':
      return 'En proceso';
    default:
      return status;
  }
}

export default function ClientCreditPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debtModalOpen, setDebtModalOpen] = useState(false);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || session?.user?.role !== 'client') return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch('/api/credit/summary')
      .then((res) => {
        if (!res.ok) {
          return res.json().then((b) => {
            throw new Error(b?.error || res.statusText);
          });
        }
        return res.json();
      })
      .then((body: { success?: boolean; data?: CreditSummary }) => {
        if (cancelled || !body?.data) return;
        setSummary(body.data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, session?.user?.role]);

  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && session?.user?.role !== 'client')) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ipmach-yellow" />
      </div>
    );
  }

  if (session?.user?.role !== 'client') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ipmach-dark">Crédito y cartera</h1>
        <p className="mt-1 text-sm text-gray-600">
          Consulta tu línea de crédito con Proshel, tu cartera (deuda general) y las órdenes abiertas que consumen
          cupo.
        </p>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">Cargando…</div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
      )}

      {!loading && !loadError && summary && (
        <>
          {summary.portfolioBlocked && (
            <section
              className="rounded-lg border border-red-300 bg-red-50 p-5"
              aria-labelledby="portfolio-block-heading"
            >
              <div className="flex gap-3">
                <ExclamationTriangleIcon className="h-8 w-8 flex-shrink-0 text-red-700" aria-hidden />
                <div>
                  <h2 id="portfolio-block-heading" className="text-lg font-semibold text-red-900">
                    Cartera vencida — órdenes bloqueadas
                  </h2>
                  <p className="mt-2 text-sm text-red-900/95">
                    {summary.portfolioBlockMessage ||
                      'Tiene facturas pendientes con más de 10 días de mora después del plazo de pago. Debe poner al día la cartera para generar nuevas órdenes de compra.'}
                  </p>
                  {summary.hasCredit &&
                    (() => {
                      const term = summary.creditDaysLimit ?? summary.creditPaymentTermDays;
                      return term != null ? (
                        <p className="mt-2 text-xs text-red-800/90">
                          Plazo de pago (Filipo):{' '}
                          <strong>
                            {term === 0 ? 'sin tope de días' : `${term} días`}
                          </strong>{' '}
                          desde la fecha del documento. En el detalle de documentos puede ver vencimiento y estado.
                        </p>
                      ) : null;
                    })()}
                </div>
              </div>
            </section>
          )}

          {/* 2.3 No credit line */}
          {!summary.hasCredit && (
            <section
              className="rounded-lg border border-amber-200 bg-amber-50 p-5"
              aria-labelledby="no-credit-heading"
            >
              <div className="flex gap-3">
                <InformationCircleIcon className="h-8 w-8 flex-shrink-0 text-amber-700" aria-hidden />
                <div>
                  <h2 id="no-credit-heading" className="text-lg font-semibold text-amber-900">
                    Sin línea de crédito activa
                  </h2>
                  <p className="mt-2 text-sm text-amber-900/90">
                    Actualmente no tienes una línea de crédito habilitada con Proshel en esta plataforma. Puedes
                    solicitarla contactando a tu <strong>asesor comercial de cuenta</strong> o a nuestro equipo de
                    soporte.
                  </p>
                  <a
                    href={SUPPORT_WHATSAPP_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center rounded-md border border-green-600 bg-white px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-50"
                  >
                    Escribir por WhatsApp (soporte)
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* 2.1 Available credit + formula */}
          {summary.hasCredit && summary.creditLimit != null && (
            <section className="rounded-lg border border-ipmach-dark/10 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-ipmach-dark mb-4">
                <BanknotesIcon className="h-6 w-6" aria-hidden />
                <h2 className="text-lg font-semibold">Crédito disponible</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Cupo total que Proshel tiene habilitado para tu cuenta, menos lo que ya está comprometido en cartera y
                en órdenes abiertas en este sistema.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cupo total autorizado</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(summary.creditLimit, 'USD')}
                  </p>
                </div>
                <div className="rounded-md bg-ipmach-yellow/15 border border-ipmach-yellow/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ipmach-dark/80">Cupo disponible</p>
                  <p className="mt-1 text-2xl font-bold text-ipmach-dark">
                    {formatCurrency(summary.availableCredit, 'USD')}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500 leading-relaxed">
                <strong>Fórmula:</strong> cupo disponible = cupo total − deuda general (cartera) − suma de órdenes en
                estado Pendiente o En proceso en esta plataforma.
              </p>
              {(() => {
                const term = summary.creditDaysLimit ?? summary.creditPaymentTermDays;
                return term != null ? (
                  <p className="mt-3 text-xs text-gray-600">
                    <strong>Plazo de pago (cartera, Filipo):</strong>{' '}
                    {term === 0
                      ? 'sin tope de días.'
                      : `${term} días desde la fecha de cada documento.`}{' '}
                    {term !== 0 &&
                      `Si un saldo pendiente supera ese plazo en más de ${summary.portfolioOverdueGraceDays ?? 10} días, no podrá crear órdenes hasta regularizar.`}
                  </p>
                ) : null;
              })()}
            </section>
          )}

          {/* Deuda general — 2.1 detail */}
          <section className="rounded-lg border border-ipmach-dark/10 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-ipmach-dark mb-2">
              <DocumentTextIcon className="h-6 w-6" aria-hidden />
              <h2 className="text-lg font-semibold">Deuda general (cartera)</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Monto pendiente según la facturación / cartera vinculada a tu cuenta (sistema de documentos). Esto reduce
              tu cupo disponible cuando tienes línea de crédito.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-semibold text-gray-900">
                {formatCurrency(summary.externalDebt, 'USD')}
              </span>
              <button
                type="button"
                onClick={() => setDebtModalOpen(true)}
                className="inline-flex items-center rounded-md border border-ipmach-dark/20 bg-white px-3 py-1.5 text-sm font-medium text-ipmach-dark hover:bg-gray-50"
              >
                Ver detalle de documentos
              </button>
            </div>
          </section>

          {/* Órdenes pendientes — 2.2 */}
          <section className="rounded-lg border border-ipmach-dark/10 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-ipmach-dark mb-2">
              <ClipboardDocumentListIcon className="h-6 w-6" aria-hidden />
              <h2 className="text-lg font-semibold">Órdenes que consumen cupo</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Pedidos creados aquí que siguen en <strong>Pendiente</strong> o <strong>En proceso</strong>. Su valor
              total se resta del cupo disponible junto con la deuda general.
            </p>
            <p className="mb-3 text-sm font-medium text-gray-800">
              Total en órdenes abiertas:{' '}
              <span className="text-ipmach-dark">{formatCurrency(summary.pendingOrdersSum, 'USD')}</span>
            </p>

            {summary.pendingOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No tienes órdenes pendientes o en proceso.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Orden</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Estado</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {summary.pendingOrders.map((o) => (
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
                        <td className="px-3 py-2">{statusLabel(o.status)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(o.totalAmount, 'USD')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4">
              <Link
                href="/orders"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Ir a todas las órdenes →
              </Link>
            </div>
          </section>
        </>
      )}

      <PendingDebtDetail
        isOpen={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        isClientTheme
        paymentTermDays={summary?.creditDaysLimit ?? summary?.creditPaymentTermDays ?? null}
        platformOpenOrders={summary?.pendingOrders ?? []}
      />
    </div>
  );
}
