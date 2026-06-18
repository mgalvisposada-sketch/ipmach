'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import {
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/utils';

type InvoiceRow = {
  id: string;
  externalId: string | null;
  type: 'sale' | 'remision';
  total: number;
  paid: number;
  pending: number;
  freg: string | null;
  fullyPaid: boolean;
  clientName?: string | null;
  clientExternalId?: string | null;
};

type InvoicesResponse = {
  error?: unknown;
  data?: { invoicesByClientId?: Record<string, InvoiceRow[]> };
};

function formatDocDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function typeLabel(t: string): string {
  if (t === 'sale') return 'Venta';
  if (t === 'remision') return 'Remisión';
  return t;
}

function invoiceRowKey(inv: InvoiceRow): string {
  return `${inv.id}-${inv.type}`;
}

export default function FacturasPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const role = session?.user?.role;
  const showClientColumn = role === 'admin' || role === 'agent';

  const canAccess = role === 'client' || role === 'admin' || role === 'agent';

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !canAccess) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch('/api/billing/invoices?balanceFilter=all&limit=500')
      .then((res) => {
        if (!res.ok) {
          return res.json().then((b) => {
            throw new Error((b as { error?: string })?.error || res.statusText);
          });
        }
        return res.json();
      })
      .then((body: InvoicesResponse) => {
        if (cancelled) return;
        const map = body?.data?.invoicesByClientId;
        if (!map || typeof map !== 'object') {
          setRows([]);
          return;
        }
        const flat: InvoiceRow[] = [];
        for (const list of Object.values(map)) {
          if (Array.isArray(list)) {
            flat.push(...list);
          }
        }
        flat.sort((a, b) => {
          const ta = a.freg ? new Date(a.freg).getTime() : 0;
          const tb = b.freg ? new Date(b.freg).getTime() : 0;
          return tb - ta;
        });
        setRows(flat);
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
  }, [sessionStatus, canAccess]);

  const pdfHref = useMemo(() => {
    return (inv: InvoiceRow) => {
      const ext = inv.externalId != null ? String(inv.externalId) : '';
      const base = `/api/billing/invoices/${encodeURIComponent(ext)}/pdf?type=${encodeURIComponent(inv.type)}`;
      if (showClientColumn && inv.clientExternalId) {
        return `${base}&clientId=${encodeURIComponent(inv.clientExternalId)}`;
      }
      return base;
    };
  }, [showClientColumn]);

  const handleDownloadPdf = useCallback(
    async (inv: InvoiceRow) => {
      const key = invoiceRowKey(inv);
      try {
        toast.loading('Generando PDF...', { id: 'factura-pdf' });
        setDownloadingKey(key);
        const response = await fetch(pdfHref(inv), { method: 'GET' });
        if (!response.ok) {
          let message = 'Error al generar el PDF';
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message);
        }
        const blob = await response.blob();
        const safeRef = String(inv.externalId ?? inv.id.slice(0, 8)).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = `factura-${safeRef}-${inv.type}.pdf`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF generado exitosamente', { id: 'factura-pdf' });
      } catch (error) {
        console.error('Facturas PDF export error:', error);
        toast.error(error instanceof Error ? error.message : 'Error al generar el PDF', { id: 'factura-pdf' });
      } finally {
        setDownloadingKey(null);
      }
    },
    [pdfHref]
  );

  if (sessionStatus === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ipmach-yellow" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600">No tienes permiso para ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <DocumentDuplicateIcon className="h-8 w-8 text-ipmach-dark" aria-hidden />
        <div>
          <h1 className="text-2xl font-bold text-ipmach-dark">Facturas</h1>
          <p className="text-sm text-gray-600 mt-1">
            Historial de ventas y remisiones (cartera Filipo). Descarga el PDF con el mismo formato que en
            documentos.
          </p>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Cargando…
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
      )}

      {!loading && !loadError && (
        <div className="rounded-lg border border-ipmach-dark/10 bg-white shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No hay facturas para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Ref.</th>
                    {showClientColumn && (
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Cliente</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Pagado</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Pendiente</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Estado</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((inv) => {
                    const rowKey = invoiceRowKey(inv);
                    return (
                    <tr key={rowKey}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {inv.externalId != null ? String(inv.externalId) : inv.id.slice(0, 8)}
                      </td>
                      {showClientColumn && (
                        <td className="px-3 py-2 text-gray-700">
                          {inv.clientName || inv.clientExternalId || '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-gray-600">{formatDocDate(inv.freg)}</td>
                      <td className="px-3 py-2">{typeLabel(inv.type)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(inv.total, 'USD')}</td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {formatCurrency(inv.paid, 'USD')}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(inv.pending, 'USD')}</td>
                      <td className="px-3 py-2">
                        {inv.fullyPaid ? (
                          <span className="text-green-700">Pagado</span>
                        ) : (
                          <span className="text-amber-700">Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {inv.externalId != null && String(inv.externalId).trim() !== '' ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(inv)}
                            disabled={downloadingKey === rowKey}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
                            {downloadingKey === rowKey ? '…' : 'PDF'}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
