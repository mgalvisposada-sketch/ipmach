/**
 * Fetches document line detail from Filipo Documents API for local PDF generation.
 * Expected: GET /api/v1/documents/{externalId}?type=sale|remision&clientId=...
 * with X-API-Token (same auth as other v1 routes).
 *
 * Response shape is normalized defensively — Filipo may use `data.items`, `lines`, or `data.lines`.
 */

const FETCH_TIMEOUT_MS = 60_000;

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

function getDocumentsApiConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export type FilipoDocumentLineForPdf = {
  reference: string;
  description: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type FilipoDocumentDetailForPdf = {
  clientName: string | null;
  /** Document date for PDF */
  documentDate: Date;
  items: FilipoDocumentLineForPdf[];
  observations: string | null;
  /** When set, PDF totals use these instead of summing lines */
  totalsOverride?: {
    subtotal: number;
    discountAmount: number;
    discountPercent: number;
    total: number;
  };
};

function normalizeLine(raw: unknown): FilipoDocumentLineForPdf | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const reference = pickString(r, ['reference', 'ref', 'productReference', 'sku', 'code', 'pro']);
  const brand = pickString(r, ['brand', 'marca']);
  let description = pickString(r, ['description', 'name', 'productName', 'detail', 'product', 'title', 'des']);
  const quantity = pickNum(r, ['quantity', 'qty', 'cantidad', 'amount', 'can']) ?? 1;
  const unitPrice =
    pickNum(r, ['unitPrice', 'price', 'unit', 'precio', 'valorUnitario', 'valu']) ?? 0;
  const lineTotal =
    pickNum(r, ['totalPrice', 'lineTotal', 'total', 'importe', 'subtotalLine', 'valt']) ??
    unitPrice * Math.max(quantity, 0);

  if (!description && !reference) return null;

  return {
    reference,
    description,
    brand,
    quantity: Math.max(0, quantity),
    unitPrice: Math.max(0, unitPrice),
    totalPrice: Math.max(0, lineTotal),
  };
}

function unwrapData(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.data && typeof b.data === 'object') {
    return b.data as Record<string, unknown>;
  }
  return b;
}

function extractItems(root: Record<string, unknown>): unknown[] {
  const candidates = ['items', 'lines', 'details', 'documentLines', 'products'];
  for (const k of candidates) {
    const v = root[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function parseDocumentDate(raw: unknown): Date {
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * GET /api/v1/sales/{externalId}/items — line detail for a sale (Filipo).
 * `externalId` is the sale number as shown in Filipo (e.g. document externalId), not an internal UUID.
 */
async function fetchFilipoSaleItemsForPdf(
  externalId: string,
  clientId: string | null | undefined
): Promise<FilipoDocumentLineForPdf[]> {
  const config = getDocumentsApiConfig();
  if (!config) return [];

  const url = new URL(`${config.baseUrl}/api/v1/sales/${encodeURIComponent(externalId)}/items`);
  if (clientId?.trim()) {
    url.searchParams.set('clientId', clientId.trim());
  }

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Token': config.token,
        },
      },
      FETCH_TIMEOUT_MS
    );
    const text = await res.text();
    if (!res.ok) return [];
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return [];
    }
    const payload = body as { data?: unknown };
    const raw = Array.isArray(payload?.data) ? payload.data : [];
    const sorted = [...raw].sort((a, b) => {
      const pa =
        typeof a === 'object' && a && 'pos' in (a as object)
          ? Number((a as Record<string, unknown>).pos)
          : 0;
      const pb =
        typeof b === 'object' && b && 'pos' in (b as object)
          ? Number((b as Record<string, unknown>).pos)
          : 0;
      return (Number.isFinite(pa) ? pa : 0) - (Number.isFinite(pb) ? pb : 0);
    });
    const items: FilipoDocumentLineForPdf[] = [];
    for (const row of sorted) {
      const line = normalizeLine(row);
      if (line) items.push(line);
    }
    return items;
  } catch {
    return [];
  }
}

type InvoiceListLookupResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; status?: number };

/**
 * Loads GET /api/v1/clients/invoices and finds the row for externalId + type.
 */
async function lookupInvoiceRowInList(
  params: FetchFilipoDocumentDetailParams
): Promise<InvoiceListLookupResult> {
  const config = getDocumentsApiConfig();
  if (!config) {
    return { ok: false, error: 'Documents API not configured' };
  }

  const url = new URL(`${config.baseUrl}/api/v1/clients/invoices`);
  if (params.clientId?.trim()) {
    url.searchParams.set('clientId', params.clientId.trim());
  }
  url.searchParams.set('balanceFilter', 'all');
  url.searchParams.set('limit', '500');

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Token': config.token,
        },
      },
      FETCH_TIMEOUT_MS
    );
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        error: 'Invoices list returned non-JSON (check DOCUMENTS_API_BASE_URL)',
        status: res.status,
      };
    }

    if (!res.ok) {
      const msg =
        typeof (body as { error?: { message?: string } })?.error?.message === 'string'
          ? (body as { error: { message: string } }).error.message
          : res.statusText;
      return { ok: false, error: msg || 'Invoices API error', status: res.status };
    }

    const data = body as { data?: { invoicesByClientId?: Record<string, unknown[]> } };
    const map = data?.data?.invoicesByClientId;
    const rows: unknown[] = [];
    if (map && typeof map === 'object') {
      for (const list of Object.values(map)) {
        if (Array.isArray(list)) {
          rows.push(...list);
        }
      }
    }

    const ext = String(params.externalId).trim();
    const match = rows.find((r) => {
      if (!r || typeof r !== 'object') return false;
      const o = r as Record<string, unknown>;
      const ex = o.externalId != null ? String(o.externalId) : '';
      const typ = typeof o.type === 'string' ? o.type : '';
      return ex === ext && typ === params.type;
    });

    if (!match || typeof match !== 'object') {
      return {
        ok: false,
        error:
          'Document not found in invoices list. Ensure clientId matches the row (admin/agent) or the document exists.',
        status: 404,
      };
    }

    return { ok: true, row: match as Record<string, unknown> };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? 'Request timed out' : err instanceof Error ? err.message : 'Fetch failed',
    };
  }
}

function buildDetailFromInvoiceRowAndSaleLines(
  row: Record<string, unknown>,
  saleLines: FilipoDocumentLineForPdf[]
): FilipoDocumentDetailForPdf {
  const total = typeof row.total === 'number' ? row.total : Number(row.total) || 0;
  const paid = typeof row.paid === 'number' ? row.paid : Number(row.paid) || 0;
  const pending = typeof row.pending === 'number' ? row.pending : Number(row.pending) || 0;
  const freg = typeof row.freg === 'string' ? row.freg : null;
  const clientName = typeof row.clientName === 'string' ? row.clientName : null;

  return {
    clientName,
    documentDate: freg ? parseDocumentDate(freg) : new Date(),
    items: saleLines,
    observations:
      paid !== 0 || pending !== 0
        ? `Paid: ${paid.toFixed(2)} USD — Pending: ${pending.toFixed(2)} USD`
        : null,
    totalsOverride: {
      subtotal: total,
      discountAmount: 0,
      discountPercent: 0,
      total: Math.max(0, total),
    },
  };
}

export type FetchFilipoDocumentDetailParams = {
  externalId: string;
  type: 'sale' | 'remision';
  clientId?: string | null;
};

export type FetchFilipoDocumentDetailResult =
  | { ok: true; detail: FilipoDocumentDetailForPdf }
  | { ok: false; error: string; status?: number };

async function fetchDocumentJson(
  baseUrl: string,
  token: string,
  pathSegments: string,
  type: string,
  clientId: string | null | undefined
): Promise<{ res: Response; text: string }> {
  const url = new URL(`${baseUrl}/${pathSegments.replace(/^\//, '')}`);
  url.searchParams.set('type', type);
  if (clientId?.trim()) {
    url.searchParams.set('clientId', clientId.trim());
  }
  const res = await fetchWithTimeout(
    url.toString(),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Token': token,
      },
    },
    FETCH_TIMEOUT_MS
  );
  const text = await res.text();
  return { res, text };
}

/**
 * Loads invoice rows from GET /api/v1/clients/invoices (same as /facturas list).
 * Used when per-document JSON is not available; builds a one-line summary PDF.
 */
async function fetchInvoiceSummaryFromClientsInvoicesApi(
  params: FetchFilipoDocumentDetailParams
): Promise<FetchFilipoDocumentDetailResult> {
  const lookup = await lookupInvoiceRowInList(params);
  if (!lookup.ok) {
    return { ok: false, error: lookup.error, status: lookup.status };
  }

  const row = lookup.row;
  const ext = String(params.externalId).trim();
  const total = typeof row.total === 'number' ? row.total : Number(row.total) || 0;
  const paid = typeof row.paid === 'number' ? row.paid : Number(row.paid) || 0;
  const pending = typeof row.pending === 'number' ? row.pending : Number(row.pending) || 0;
  const freg = typeof row.freg === 'string' ? row.freg : null;
  const clientName = typeof row.clientName === 'string' ? row.clientName : null;

  const detail: FilipoDocumentDetailForPdf = {
    clientName,
    documentDate: freg ? parseDocumentDate(freg) : new Date(),
    items: [
      {
        reference: ext,
        description:
          'Document total (summary — line-level detail API not available; totals match Filipo list)',
        brand: '',
        quantity: 1,
        unitPrice: total,
        totalPrice: total,
      },
    ],
    observations:
      paid !== 0 || pending !== 0
        ? `Paid: ${paid.toFixed(2)} USD — Pending: ${pending.toFixed(2)} USD`
        : null,
    totalsOverride: {
      subtotal: total,
      discountAmount: 0,
      discountPercent: 0,
      total: Math.max(0, total),
    },
  };

  return { ok: true, detail };
}

/**
 * GET /api/v1/documents/{externalId} (preferred) or /api/documents/{externalId} — JSON detail for PDF generation.
 */
export async function fetchFilipoDocumentDetailForPdf(
  params: FetchFilipoDocumentDetailParams
): Promise<FetchFilipoDocumentDetailResult> {
  const config = getDocumentsApiConfig();
  if (!config) {
    return { ok: false, error: 'Documents API not configured' };
  }

  const { externalId, type, clientId } = params;

  try {
    let res: Response;
    let text: string;
    const first = await fetchDocumentJson(
      config.baseUrl,
      config.token,
      `api/v1/documents/${encodeURIComponent(externalId)}`,
      type,
      clientId
    );
    res = first.res;
    text = first.text;

    if (res.status === 404) {
      const second = await fetchDocumentJson(
        config.baseUrl,
        config.token,
        `api/documents/${encodeURIComponent(externalId)}`,
        type,
        clientId
      );
      res = second.res;
      text = second.text;
    }
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: 'Invalid JSON from Documents API', status: res.status };
    }

    if (!res.ok) {
      const msg =
        typeof (body as { error?: { message?: string } })?.error?.message === 'string'
          ? (body as { error: { message: string } }).error.message
          : res.statusText;
      return { ok: false, error: msg || 'Documents API error', status: res.status };
    }

    const root = unwrapData(body);
    if (!root) {
      return { ok: false, error: 'Empty document payload' };
    }

    const rawItems = extractItems(root);
    const items: FilipoDocumentLineForPdf[] = [];
    for (const row of rawItems) {
      const line = normalizeLine(row);
      if (line) items.push(line);
    }

    const clientName =
      pickString(root, ['clientName', 'customerName', 'name', 'razonSocial']) || null;

    const freg = pickString(root, ['freg', 'date', 'documentDate', 'createdAt', 'fecha']);
    const documentDate = parseDocumentDate(freg || undefined);

    const observations =
      pickString(root, ['observations', 'notes', 'note', 'comments', 'observaciones']) || null;

    const subtotalNum = pickNum(root, ['subtotal', 'subTotal', 'base']);
    const discountNum = pickNum(root, ['discountAmount', 'discount', 'descuento']);
    const discountPct = pickNum(root, ['discountPercent', 'discountPct', 'pctDescuento']);
    const totalNum = pickNum(root, ['total', 'totalAmount', 'importeTotal']);

    let totalsOverride: FilipoDocumentDetailForPdf['totalsOverride'];
    if (totalNum != null && Number.isFinite(totalNum) && totalNum >= 0) {
      const sub =
        subtotalNum != null && Number.isFinite(subtotalNum) ? subtotalNum : totalNum;
      const disc =
        discountNum != null && Number.isFinite(discountNum) ? Math.max(0, discountNum) : 0;
      totalsOverride = {
        subtotal: sub,
        discountAmount: disc,
        discountPercent:
          discountPct != null && Number.isFinite(discountPct)
            ? discountPct
            : sub > 0 && disc > 0
              ? (disc / sub) * 100
              : 0,
        total: Math.max(0, totalNum),
      };
    }

    if (items.length === 0 && !totalsOverride) {
      if (type === 'sale') {
        const saleItems = await fetchFilipoSaleItemsForPdf(externalId, clientId);
        if (saleItems.length > 0) {
          return {
            ok: true,
            detail: {
              clientName,
              documentDate,
              items: saleItems,
              observations,
              totalsOverride: undefined,
            },
          };
        }
      }
      return {
        ok: false,
        error: 'Document has no line items and no totals in API response',
        status: 422,
      };
    }

    return {
      ok: true,
      detail: {
        clientName,
        documentDate,
        items,
        observations,
        totalsOverride,
      },
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? 'Request timed out' : err instanceof Error ? err.message : 'Fetch failed',
    };
  }
}

/**
 * Tries Filipo document JSON first; for sales, enriches line items from GET /api/v1/sales/{externalId}/items
 * when the document payload has no lines. If the document route fails, tries sale items plus the invoices list row,
 * then falls back to GET /api/v1/clients/invoices (same source as /facturas). PDF is always generated locally.
 */
export async function fetchFilipoInvoiceDetailForPdf(
  params: FetchFilipoDocumentDetailParams
): Promise<FetchFilipoDocumentDetailResult> {
  const primary = await fetchFilipoDocumentDetailForPdf(params);

  if (primary.ok) {
    if (params.type === 'sale' && primary.detail.items.length === 0) {
      const saleLines = await fetchFilipoSaleItemsForPdf(params.externalId, params.clientId);
      if (saleLines.length > 0) {
        return {
          ok: true,
          detail: {
            ...primary.detail,
            items: saleLines,
          },
        };
      }
    }
    return primary;
  }

  if (primary.status === 403) {
    return primary;
  }

  if (params.type === 'sale') {
    const saleLines = await fetchFilipoSaleItemsForPdf(params.externalId, params.clientId);
    if (saleLines.length > 0) {
      const lookup = await lookupInvoiceRowInList(params);
      if (lookup.ok) {
        return {
          ok: true,
          detail: buildDetailFromInvoiceRowAndSaleLines(lookup.row, saleLines),
        };
      }
      return {
        ok: true,
        detail: {
          clientName: null,
          documentDate: new Date(),
          items: saleLines,
          observations: null,
          totalsOverride: undefined,
        },
      };
    }
  }

  console.info(
    '[filipo-document-detail] Document JSON unavailable, using invoices list summary:',
    primary.error
  );

  return fetchInvoiceSummaryFromClientsInvoicesApi(params);
}
