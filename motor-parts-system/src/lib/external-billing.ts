import { prisma } from '@/lib/prisma';

const DOCUMENTS_API_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export type ExternalBillingDocument = {
  id: string;
  externalId?: number;
  type?: string;
  total: number;
  paid: number;
  pending: number;
  freg?: string;
};

export type ExternalBillingClientPayload = {
  pendingAmount: number;
  unpaidDocumentsCount?: number;
  lastPayments?: unknown[];
  totalPaid?: number;
  lastDocumentDate?: string | null;
  documents?: ExternalBillingDocument[];
  billedOrderNumbers?: string[];
  billedOrders?: { orderNumber: string; total: number; billed: boolean; sourceOrderNumber?: string | null }[];
};

type BillingApiEnvelope = {
  data?: { billingByClientId?: Record<string, ExternalBillingClientPayload> };
};

function normalizeDocuments(raw: unknown): ExternalBillingDocument[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExternalBillingDocument[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id : r.id != null ? String(r.id) : '';
    if (!id) continue;
    const total = typeof r.total === 'number' ? r.total : Number(r.total) || 0;
    const paid = typeof r.paid === 'number' ? r.paid : Number(r.paid) || 0;
    const pending = typeof r.pending === 'number' ? r.pending : Number(r.pending) || 0;
    const externalId =
      typeof r.externalId === 'number'
        ? r.externalId
        : r.externalId != null
          ? Number(r.externalId)
          : undefined;
    const type = typeof r.type === 'string' ? r.type : undefined;
    const freg = typeof r.freg === 'string' ? r.freg : undefined;
    out.push({
      id,
      externalId: Number.isFinite(externalId as number) ? (externalId as number) : undefined,
      type,
      total,
      paid,
      pending,
      freg,
    });
  }
  return out.length ? out : [];
}

function normalizePayload(entry: Record<string, unknown> | null | undefined): ExternalBillingClientPayload | null {
  if (!entry || typeof entry !== 'object') return null;
  const pendingAmount =
    typeof entry.pendingAmount === 'number'
      ? entry.pendingAmount
      : entry.pendingAmount != null
        ? Number(entry.pendingAmount)
        : 0;
  const documents = normalizeDocuments(entry.documents);

  const billedOrders = Array.isArray(entry.billedOrders)
    ? (entry.billedOrders as any[]).map(o => ({
        orderNumber: String(o.orderNumber || ''),
        total: Number(o.total) || 0,
        billed: Boolean(o.billed),
        sourceOrderNumber: o.sourceOrderNumber ? String(o.sourceOrderNumber) : null
      }))
    : undefined;

  return {
    pendingAmount: Number.isFinite(pendingAmount) ? Math.max(0, pendingAmount) : 0,
    unpaidDocumentsCount:
      typeof entry.unpaidDocumentsCount === 'number'
        ? entry.unpaidDocumentsCount
        : entry.unpaidDocumentsCount != null
          ? Number(entry.unpaidDocumentsCount)
          : undefined,
    lastPayments: entry.lastPayments as unknown[] | undefined,
    totalPaid:
      typeof entry.totalPaid === 'number'
        ? entry.totalPaid
        : entry.totalPaid != null
          ? Number(entry.totalPaid)
          : undefined,
    lastDocumentDate:
      typeof entry.lastDocumentDate === 'string' || entry.lastDocumentDate === null
        ? (entry.lastDocumentDate as string | null)
        : undefined,
    documents,
    billedOrderNumbers: entry.billedOrderNumbers as string[] | undefined,
    billedOrders,
  };
}

/**
 * Fetches billing payload from Documents API for a user (by identification or CLI{id}).
 * On failure returns payload: null and optional error (caller may fail-open).
 */
export async function getExternalBillingForClientUserId(
  userId: number,
  detail: 'summary' | 'documents'
): Promise<{
  clientId: string;
  payload: ExternalBillingClientPayload | null;
  error?: string;
}> {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    return { clientId: '', payload: null, error: 'Billing service not configured' };
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, identification: true },
  });
  if (!user) {
    return { clientId: '', payload: null, error: 'User not found' };
  }

  const clientId = user.identification?.trim() || `CLI${user.id}`;
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/clients/pending`);
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('detail', detail === 'documents' ? 'documents' : 'summary');

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: { 'X-API-Token': token },
      },
      DOCUMENTS_API_TIMEOUT_MS
    );

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { clientId, payload: null, error: 'Invalid response from billing service' };
    }

    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error || res.statusText;
      if (res.status >= 500) {
        console.warn('[external-billing] Documents API error:', res.status, errMsg);
      }
      return { clientId, payload: null, error: errMsg };
    }

    const billingByClientId = (data as BillingApiEnvelope)?.data?.billingByClientId;
    if (!billingByClientId || typeof billingByClientId !== 'object') {
      return { clientId, payload: null };
    }

    const rawEntry =
      (billingByClientId as Record<string, Record<string, unknown>>)[clientId] ??
      (Object.values(billingByClientId)[0] as Record<string, unknown> | undefined);
    const payload = normalizePayload(rawEntry);
    return { clientId, payload };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn('[external-billing] Error for userId', userId, isAbort ? 'timeout' : err);
    return {
      clientId,
      payload: null,
      error: isAbort ? 'Request timed out' : 'Failed to fetch pending billing',
    };
  }
}

/**
 * Fetches the external (Documents API) pending amount for a client by user id.
 * Used server-side for credit limit checks (e.g. GET /api/users/[id], POST /api/orders).
 * On API failure returns pendingAmount: 0 so we do not block users due to external service unavailability.
 */
/**
 * Extracts Motor order IDs from Filipo orderNumber strings.
 * Motor sends orderId as the leading numeric prefix of Filipo's orderNumber
 * (e.g. "21" or "21 - Pedido X"). Returns a Set of parsed numeric IDs.
 */
export function extractBilledMotorOrderIds(billedOrders: { orderNumber: string; total: number; billed: boolean; sourceOrderNumber?: string | null }[] | undefined): Map<number, { total: number; billed: boolean }> {
  const map = new Map<number, { total: number; billed: boolean }>();
  for (const o of billedOrders ?? []) {
    // Prioritize clean sourceOrderNumber field
    let motorId = o.sourceOrderNumber ? parseInt(o.sourceOrderNumber, 10) : NaN;
    
    // Fallback to parsing the orderNumber prefix
    if (isNaN(motorId)) {
      motorId = parseInt(o.orderNumber.split(' ')[0], 10);
    }

    if (!isNaN(motorId) && motorId > 0) {
      map.set(motorId, { total: o.total, billed: o.billed });
    }
  }
  return map;
}

export async function getExternalPendingByClientUserId(
  userId: number
): Promise<{ pendingAmount: number; billedOrders?: { orderNumber: string; total: number; billed: boolean }[]; error?: string }> {
  const { payload, error } = await getExternalBillingForClientUserId(userId, 'summary');
  if (!payload) {
    return { pendingAmount: 0, error };
  }
  return {
    pendingAmount: payload.pendingAmount,
    billedOrders: payload.billedOrders,
    error,
  };
}

/**
 * Fetches all orders from Filipo's new external matching endpoint.
 * Returns a Map of MotorOrderId -> { total, billed }
 */
export async function getAllFilipoOrdersForMatching(): Promise<Map<number, { total: number; billed: boolean }>> {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) return new Map();

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/external/orders`;
  console.log(`[EXTERNAL_BILLING] Syncing with Filipo: curl -X GET "${url}" -H "X-API-Token: ${token.substring(0, 5)}***"`);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'X-API-Token': token },
    }, DOCUMENTS_API_TIMEOUT_MS);

    if (!res.ok) return new Map();
    const data = await res.json();
    const filipoOrders = data.data?.orders || [];
    
    const map = new Map<number, { total: number; billed: boolean }>();
    for (const o of filipoOrders) {
      if (o.motorOrderId) {
        map.set(o.motorOrderId, { total: o.total, billed: o.isBilled });
      }
    }
    return map;
  } catch (err) {
    console.error('[external-billing] Global orders fetch failed:', err);
    return new Map();
  }
}
