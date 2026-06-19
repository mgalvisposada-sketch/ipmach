import { computeExpectedOrderTotalUsd } from '@/lib/international-carrier-surcharge';

/** Per-request timeout for each Documents API fetch. */
const DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

type OrderItemShape = {
  reference?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  description?: string;
  basePriceCOP?: number;
  unitCost?: number;
};

const documentsApiHeaders = (token: string) => ({
  'X-API-Token': token,
  'Content-Type': 'application/json',
});

async function getProductIdByReference(
  base: string,
  token: string,
  reference: string
): Promise<number | null> {
  const url = `${base}/api/v1/products?reference=${encodeURIComponent(reference)}`;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'X-API-Token': token } },
      DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const getData = await res.json();
    const list = Array.isArray(getData.data)
      ? getData.data
      : Array.isArray(getData.products)
        ? getData.products
        : Array.isArray(getData)
          ? getData
          : [];
    const match = (p: { reference?: string; Reference?: string; sku?: string }) =>
      (p.reference ?? p.Reference ?? p.sku ?? '').toLowerCase() === reference.toLowerCase();
    const product = list.find(match);
    if (!product) return null;
    const id =
      product.externalId ??
      product.productId ??
      product.ProductID ??
      product.productID ??
      product.id;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}

async function getOrCreateProductInDocumentsApi(
  baseUrl: string,
  token: string,
  reference: string,
  unitPrice: number,
  _description?: string
): Promise<number | null> {
  const base = baseUrl.replace(/\/$/, '');

  const existingId = await getProductIdByReference(base, token, reference);
  if (existingId != null) return existingId;

  const createUrl = `${base}/api/v1/products`;
  const price = Math.round(unitPrice * 100) / 100;
  const body = {
    name: `Producto ${reference}`,
    price,
    stock: 1,
    reference,
  };

  try {
    const res = await fetchWithTimeout(
      createUrl,
      {
        method: 'POST',
        headers: documentsApiHeaders(token),
        body: JSON.stringify(body),
      },
      DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS
    );
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch { }

    if (res.ok && data) {
      const product = data.data?.product ?? data.product;
      const id = product?.externalId ?? product?.id ?? data.data?.id ?? data.id;
      if (typeof id === 'number') return id;
    }

    if (res.status === 409 || res.status === 400) {
      const id = await getProductIdByReference(base, token, reference);
      if (id != null) return id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function pushOrderToFilipo(
  order: {
    id: number;
    clientId: number;
    clientName: string | null;
    totalAmount: unknown;
    items: unknown;
    observations?: string | null;
    orderName?: string | null;
    clientType?: number | null;
    dispatchType?: string | null;
    pickupEntity?: string | null;
    pickupName?: string | null;
    carrierName?: string | null;
    carrierAddress?: string | null;
    carrierPhone?: string | null;
    carrierContactName?: string | null;
    paymentMethod?: string | null;
  },
  client: {
    id: number;
    username: string | null;
    identification?: string | null;
    phoneNumber?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    return { success: false, error: 'Configuración de API de Filipo faltante' };
  }

  const terceroId = client.identification?.trim() || `CLI${client.id}`;
  const customerName = order.clientName?.trim() || client.username?.trim() || `Client ${client.id}`;
  const customerPhone = (client.phoneNumber ?? '').trim();

  const rawItems = Array.isArray(order.items) ? order.items as OrderItemShape[] : [];
  const base = baseUrl.replace(/\/$/, '');

  const referenceToProductId = new Map<string, number>();
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const ref = (item.reference ?? '').trim() || `ORDER-${order.id}-ITEM-${i}`;
    if (referenceToProductId.has(ref)) continue;
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) ?? (Number(item.totalPrice) || 0) / qty;
    const productId = await getOrCreateProductInDocumentsApi(baseUrl, token, ref, unitPrice, item.description);
    if (productId != null) referenceToProductId.set(ref, productId);
  }

  const { lineSubtotalUsd } = computeExpectedOrderTotalUsd(
    rawItems as any[],
    (order.dispatchType ?? '').toString().trim()
  );

  const items = rawItems.map((item, i) => {
    const ref = (item.reference ?? '').trim() || `ORDER-${order.id}-ITEM-${i}`;
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) ?? (Number(item.totalPrice) || 0) / qty;
    const productId = referenceToProductId.get(ref) ?? 0;
    const rawCost = item.basePriceCOP ?? item.unitCost;
    const cost = typeof rawCost === 'number' && Number.isFinite(rawCost) ? Math.round(rawCost * 100) / 100 : 0;
    return { productId, quantity: qty, price: Math.round(unitPrice * 100) / 100, cost };
  });

  if (items.some(i => i.productId === 0)) {
    return { success: false, error: 'Algunos productos no pudieron ser creados en Filipo' };
  }

  const clientOrderName = (order.orderName ?? '').trim();
  const orderNameForDocumentsApi = clientOrderName.length > 0 ? `${order.id} - ${clientOrderName}` : String(order.id);

  const payload = {
    customer: { terceroId, name: customerName, phone: customerPhone },
    items,
    notes: (order.observations ?? '').trim() || 'Pedido desde API',
    status: 'created',
    orderName: orderNameForDocumentsApi,
    sourceOrderNumber: String(order.id),
    totalAmount: lineSubtotalUsd,
    clientType: order.clientType ?? null,
    dispatchType: (order.dispatchType ?? '').trim() || null,
    pickupEntity: (order.pickupEntity ?? '').trim() || null,
    pickupName: (order.pickupName ?? '').trim() || null,
    carrierName: (order.carrierName ?? '').trim() || null,
    carrierAddress: (order.carrierAddress ?? '').trim() || null,
    carrierPhone: (order.carrierPhone ?? '').trim() || null,
    carrierContactName: (order.carrierContactName ?? '').trim() || null,
    paymentMethod: (order.paymentMethod ?? '').trim() || null,
  };

  try {
    const res = await fetchWithTimeout(`${base}/api/v1/orders`, {
      method: 'POST',
      headers: documentsApiHeaders(token),
      body: JSON.stringify(payload),
    }, DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS);

    if (!res.ok) {
      const errorBody = await res.text();
      return { success: false, error: `Error de Filipo (${res.status}): ${errorBody.substring(0, 100)}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión con Filipo' };
  }
}
