import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { getExternalPendingByClientUserId, extractBilledMotorOrderIds } from '@/lib/external-billing';
import { getPortfolioBlockStateForClientUserId } from '@/lib/portfolio-receivables';
import { getFilipoClientCreditForUserId } from '@/lib/filipo-client-credit';
import { generateOrderPdfBuffer, type OrderForPdf } from '@/lib/order-pdf';
import { sendOrderConfirmationEmail } from '@/lib/email';
import {
  PAYMENT_METHOD_CREDIT_LINE,
  PAYMENT_METHOD_STRIPE,
  isValidPickupEntity,
} from '@/lib/order-details-constants';
import { computeExpectedOrderTotalUsd } from '@/lib/international-carrier-surcharge';

// Helper function to validate and round decimal amounts
const MAX_DECIMAL_VALUE = 9999999999.99;

function validateAndRoundAmount(value: number | string): number {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (!Number.isFinite(numValue)) {
    throw new Error('Invalid numeric value');
  }
  
  if (Math.abs(numValue) > MAX_DECIMAL_VALUE) {
    throw new Error(`Amount exceeds maximum allowed value of ${MAX_DECIMAL_VALUE.toLocaleString()}`);
  }
  
  // Round to 2 decimal places
  return Math.round(numValue * 100) / 100;
}

/** Sends order confirmation email to the client with PDF (includes order details: name, dispatch, payment). No-op if client has no email or config disabled. */
async function sendOrderConfirmationToClient(
  order: {
    id: number;
    clientId: number;
    clientName: string | null;
    items: unknown;
    status: string;
    createdAt: Date;
    totalAmount: unknown;
    discountPercent?: unknown;
    discountAmount?: unknown;
    ivaPercent?: unknown;
    ivaAmount?: unknown;
    observations: string | null;
    orderName?: string | null;
    dispatchType?: string | null;
    pickupEntity?: string | null;
    pickupName?: string | null;
    carrierName?: string | null;
    carrierAddress?: string | null;
    carrierPhone?: string | null;
    carrierContactName?: string | null;
    paymentMethod?: string | null;
  },
  client: { email?: string | null; username?: string | null; address?: string | null; city?: string | null; stateOrDepartment?: string | null; country?: string | null }
): Promise<void> {
  console.log(`[API ORDERS] sendOrderConfirmationToClient: order #${order.id}, clientId=${order.clientId}`);
  const email = typeof client.email === 'string' ? client.email.trim() : '';
  if (!email || email.length < 5) {
    console.warn(`[Order ${order.id}] Confirmation email not sent: client id=${order.clientId} has no valid email. Add email in Users to receive order confirmations.`);
    return;
  }

  const emailMasked = `${email.slice(0, 2)}***@${email.includes('@') ? email.split('@')[1] : '?'}`;
  console.log(`[Order ${order.id}] Sending confirmation email to client id=${order.clientId} (${emailMasked})...`);

  try {
    const pdfBuffer = await generateOrderPdfBuffer(order as OrderForPdf, client, { printReference: false });
    const result = await sendOrderConfirmationEmail(
      email,
      order.clientName || client.username || 'Cliente',
      order.id,
      pdfBuffer
    );
    if (!result.ok) {
      console.error(`[Order ${order.id}] Confirmation email failed: ${result.error ?? 'Unknown error'}`);
    }
  } catch (err) {
    console.error('[Order confirmation]', err);
    throw err;
  }
}

/** Per-request timeout for each Documents API fetch. Each request gets this limit; total flow is not capped. */
const DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS = 30_000;

/** fetch with a per-request timeout. Aborts only this request after timeoutMs; does not affect other requests. */
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
  /** Unit cost (before profit). Sent to Documents API as cost per line. */
  basePriceCOP?: number;
  unitCost?: number;
};

const documentsApiHeaders = (token: string) => ({
  'X-API-Token': token,
  'Content-Type': 'application/json',
});

/** Try to get product id by reference from Documents API (GET). Returns numeric productId or null. */
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

/**
 * Get or create a product in the Documents API by reference.
 * Tries GET /api/v1/products?reference=X first; if not found, creates via POST /api/v1/products with X-API-Token.
 * Body: { name, price, stock, reference }. Returns product id or null on failure. Does not throw.
 */
async function getOrCreateProductInDocumentsApi(
  baseUrl: string,
  token: string,
  reference: string,
  unitPrice: number,
  _description?: string
): Promise<number | null> {
  const base = baseUrl.replace(/\/$/, '');

  const existingId = await getProductIdByReference(base, token, reference);
  if (existingId != null) {
    console.log(`[Documents API] Product found by reference "${reference}": id=${existingId}`);
    return existingId;
  }

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
    let data: { data?: { id?: number }; id?: number } | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse error
    }

    if (res.ok && data) {
      const d = data as {
        data?: { product?: { externalId?: number; id?: number | string }; id?: number };
        product?: { externalId?: number; id?: number | string };
        id?: number;
      };
      const product = d.data?.product ?? d.product;
      const id =
        product?.externalId ??
        (typeof product?.id === 'number' ? product.id : null) ??
        d.data?.id ??
        (typeof d.id === 'number' ? d.id : null);
      if (id != null && typeof id === 'number') {
        console.log(`[Documents API] Product created for reference "${reference}": productId=${id}`);
        return id;
      }
    }

    if (res.status === 409 || res.status === 400) {
      const id = await getProductIdByReference(base, token, reference);
      if (id != null) return id;
    }
    console.warn(`[Documents API] Could not get or create product for "${reference}": ${res.status}`, text?.substring(0, 200));
    return null;
  } catch (err) {
    console.warn('[Documents API] getOrCreateProduct error for "' + reference + '":', err);
    return null;
  }
}

/**
 * Push order to Documents API (fire-and-forget). Ensures products exist (create if not) then pushes the order.
 * Logs on missing config or failure; never throws.
 */
async function pushOrderToDocuments(
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
): Promise<void> {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    console.warn('[Documents API] DOCUMENTS_API_BASE_URL or DOCUMENTS_API_TOKEN missing; skipping push.');
    return;
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
    const price = Math.round(unitPrice * 100) / 100;
    const productId = await getOrCreateProductInDocumentsApi(
      baseUrl,
      token,
      ref,
      price,
      (item as OrderItemShape).description
    );
    if (productId != null) referenceToProductId.set(ref, productId);
  }

  const items = rawItems.map((item, i) => {
    const ref = (item.reference ?? '').trim() || `ORDER-${order.id}-ITEM-${i}`;
    const qty = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) ?? (Number(item.totalPrice) || 0) / qty;
    const productId = referenceToProductId.get(ref) ?? 0;
    const price = Math.round(unitPrice * 100) / 100;
    const rawCost = item.basePriceCOP ?? item.unitCost;
    const cost = typeof rawCost === 'number' && Number.isFinite(rawCost)
      ? Math.round(rawCost * 100) / 100
      : 0;
    return {
      productId,
      quantity: qty,
      price,
      cost,
    };
  });

  const missing = items.filter((i) => i.productId === 0);
  if (missing.length > 0) {
    console.error(`[Documents API] Order #${order.id}: some products could not be created; skipping push.`, missing);
    return;
  }

  const totalAmountNum = order.totalAmount != null ? Number(order.totalAmount) : null;

  const clientOrderName = (order.orderName ?? '').trim();
  const orderNameForDocumentsApi =
    clientOrderName.length > 0
      ? `${order.id} - ${clientOrderName}`
      : String(order.id);

  const payload = {
    customer: { terceroId, name: customerName, phone: customerPhone },
    items,
    notes: (order.observations ?? '').trim() || 'Pedido desde API',
    status: 'created',
    orderName: orderNameForDocumentsApi,
    totalAmount: totalAmountNum,
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
    const url = `${base}/api/v1/orders`;
    console.log('[Documents API] Sending order to Documents API:', {
      orderId: order.id,
      url,
      itemCount: items.length,
      customer: payload.customer.terceroId,
      orderName: payload.orderName,
      totalAmount: payload.totalAmount,
      dispatchType: payload.dispatchType,
      paymentMethod: payload.paymentMethod,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price, cost: i.cost })),
    });
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: documentsApiHeaders(token),
        body: JSON.stringify(payload),
      },
      DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS
    );
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[Documents API] Push failed for order #${order.id}: ${res.status} ${res.statusText}`, {
        url,
        bodyPreview: errorBody?.substring(0, 300) || undefined,
      });
      return;
    }
    console.log(`[Documents API] Order #${order.id} pushed successfully.`);
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error(
      `[Documents API] Push error for order #${order.id}:`,
      isAbort ? `request timed out after ${DOCUMENTS_API_PER_REQUEST_TIMEOUT_MS / 1000}s` : err
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API ORDERS] POST /api/orders recibido');
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      items,
      clientId,
      clientName,
      clientType,
      totalAmount,
      observations,
      orderName,
      dispatchType,
      pickupEntity,
      pickupName,
      carrierName,
      carrierAddress,
      carrierPhone,
      carrierContactName,
      paymentMethod,
    } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: 'Total amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate and round totalAmount
    let validatedTotalAmount: number;
    try {
      validatedTotalAmount = validateAndRoundAmount(totalAmount);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Invalid total amount' },
        { status: 400 }
      );
    }

    const normalizedDispatchForTotal = (dispatchType ?? '').toString().trim() || null;
    const {
      expectedTotalUsd,
      lineSubtotalUsd,
      surchargeUsd,
    } = computeExpectedOrderTotalUsd(items, normalizedDispatchForTotal);
    if (Math.abs(validatedTotalAmount - expectedTotalUsd) > 0.02) {
      const detail =
        surchargeUsd > 0
          ? ` Subtotal ítems: ${lineSubtotalUsd.toFixed(2)} USD; cargo envío Miami (transportador): ${surchargeUsd.toFixed(2)} USD.`
          : ` Subtotal ítems: ${lineSubtotalUsd.toFixed(2)} USD.`;
      return NextResponse.json(
        {
          error: `El total enviado (${validatedTotalAmount.toFixed(2)} USD) no coincide con el cálculo del sistema (${expectedTotalUsd.toFixed(2)} USD).${detail}`,
        },
        { status: 400 }
      );
    }

    // Validate client ID - required for orders
    const validatedClientId = clientId ? parseInt(String(clientId)) : null;
    if (!validatedClientId || validatedClientId <= 0) {
      return NextResponse.json(
        { error: 'Client ID is required for orders' },
        { status: 400 }
      );
    }

    // Verify that the client exists in the database (include credit fields and email/address for confirmation email)
    const client = await prisma.users.findUnique({
      where: { id: validatedClientId },
      select: {
        id: true,
        username: true,
        isActive: true,
        role: true,
        identification: true,
        phoneNumber: true,
        email: true,
        address: true,
        city: true,
        stateOrDepartment: true,
        country: true,
        allowOrdersWithOverduePortfolio: true,
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const filipoCredit =
      client.role === 'client' ? await getFilipoClientCreditForUserId(validatedClientId) : null;
    const hasCreditLine = Boolean(filipoCredit?.creditEnabled);
    const creditLimitNum = filipoCredit?.creditLimit ?? 0;

    if (!client.isActive) {
      return NextResponse.json(
        { error: 'Client account is inactive' },
        { status: 403 }
      );
    }

    // If user is a client, they can only create orders for themselves
    if (session.user.role === 'client' && parseInt(session.user.id) !== validatedClientId) {
      return NextResponse.json(
        { error: 'Clients can only create orders for themselves' },
        { status: 403 }
      );
    }

    // Portfolio: block all new orders when credit client has documents overdue past grace period
    if (hasCreditLine && !client.allowOrdersWithOverduePortfolio) {
      const portfolio = await getPortfolioBlockStateForClientUserId(validatedClientId, {
        filipoCreditDaysLimit: filipoCredit?.creditDaysLimit ?? null,
      });
      if (portfolio.blocked) {
        return NextResponse.json(
          { error: portfolio.message || 'Cartera vencida: regularice su cuenta para generar órdenes.' },
          { status: 400 }
        );
      }
    }

    // For clients with credit: enforce limit vs external debt + pending orders (any payment method)
    let externalDebt = 0;
    let pendingOrdersSum = 0;
    let availableCredit: number | null = null;
    if (hasCreditLine) {
      const ext = await getExternalPendingByClientUserId(validatedClientId);
      externalDebt = ext.pendingAmount;
      const billedIds = extractBilledMotorOrderIds(ext.billedOrderNumbers);
      const pendingSum = await prisma.orders.aggregate({
        where: {
          clientId: validatedClientId,
          status: { in: ['pending', 'processing'] },
          ...(billedIds.size > 0 ? { id: { notIn: Array.from(billedIds) } } : {}),
        },
        _sum: { totalAmount: true },
      });
      pendingOrdersSum = pendingSum._sum.totalAmount != null ? Number(pendingSum._sum.totalAmount) : 0;
      availableCredit = Math.max(0, creditLimitNum - externalDebt - pendingOrdersSum);
      if (validatedTotalAmount > availableCredit) {
        return NextResponse.json(
          {
            error: `No puede generar la orden. Su deuda general (${externalDebt.toFixed(2)} USD) más las órdenes pendientes (${pendingOrdersSum.toFixed(2)} USD) superan o igualan su límite de crédito (${creditLimitNum.toFixed(2)} USD). Cupo disponible: ${availableCredit.toFixed(2)} USD. Regularice su cuenta para continuar.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate payment method: credit_line requires hasCredit and sufficient available credit
    if (paymentMethod === PAYMENT_METHOD_CREDIT_LINE) {
      if (!hasCreditLine) {
        return NextResponse.json(
          { error: 'Crédito no disponible para este cliente' },
          { status: 400 }
        );
      }
      if (availableCredit != null && validatedTotalAmount > availableCredit) {
        return NextResponse.json(
          { error: `Cupo de crédito insuficiente. Disponible: ${availableCredit.toFixed(2)} USD` },
          { status: 400 }
        );
      }
    }
    // Validate dispatch fields when dispatchType is set
    if (dispatchType === 'pickup') {
      const entity = (pickupEntity ?? '').toString().trim();
      const name = (pickupName ?? '').toString().trim();
      if (!isValidPickupEntity(entity) || !name) {
        return NextResponse.json(
          { error: 'Cuando el cliente recoge en bodega, debe seleccionar Persona o Empresa e indicar el nombre' },
          { status: 400 }
        );
      }
    }
    if (dispatchType === 'international_carrier') {
      const name = (carrierName ?? '').toString().trim();
      const addr = (carrierAddress ?? '').toString().trim();
      const phone = (carrierPhone ?? '').toString().trim();
      const contact = (carrierContactName ?? '').toString().trim();
      if (!name || !addr || !phone || !contact) {
        return NextResponse.json(
          { error: 'Cuando envía a transportador internacional, debe completar Nombre de transportadora, Dirección, Teléfono y Nombre de contacto' },
          { status: 400 }
        );
      }
    }

    // Create the order in the database
    const order = await prisma.orders.create({
      data: {
        clientId: validatedClientId,
        clientName: clientName || client.username || null,
        clientType: clientType || null,
        items: items,
        status: 'pending',
        totalAmount: validatedTotalAmount,
        observations: observations || null,
        orderName: (orderName ?? '').toString().trim() || null,
        dispatchType: (dispatchType ?? '').toString().trim() || null,
        pickupEntity: (pickupEntity ?? '').toString().trim() || null,
        pickupName: (pickupName ?? '').toString().trim() || null,
        carrierName: (carrierName ?? '').toString().trim() || null,
        carrierAddress: (carrierAddress ?? '').toString().trim() || null,
        carrierPhone: (carrierPhone ?? '').toString().trim() || null,
        carrierContactName: (carrierContactName ?? '').toString().trim() || null,
        paymentMethod: (paymentMethod ?? '').toString().trim() || null,
        paymentStatus:
          paymentMethod === PAYMENT_METHOD_STRIPE
            ? 'pending_payment'
            : paymentMethod === PAYMENT_METHOD_CREDIT_LINE
              ? 'not_required'
              : 'pending_payment',
      } as any,
    });

    pushOrderToDocuments(order, client).catch(() => {});

    // Send order confirmation email to client (with PDF). Do not block response on email/PDF errors.
    console.log(`[API ORDERS] Orden #${order.id} creada. Cliente id=${order.clientId}, email=${typeof client.email === 'string' && client.email.length >= 5 ? 'SI' : 'NO'}. Intentando enviar correo...`);
    sendOrderConfirmationToClient(order, client).catch((err) => {
      console.error('[API ORDERS] Order confirmation email error:', err);
    });

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        clientId: order.clientId,
        clientName: order.clientName,
        clientType: order.clientType,
        items: order.items,
        status: order.status,
        totalAmount: order.totalAmount,
        observations: order.observations,
        orderName: order.orderName,
        dispatchType: order.dispatchType,
        pickupEntity: order.pickupEntity,
        pickupName: order.pickupName,
        carrierName: order.carrierName,
        carrierAddress: order.carrierAddress,
        carrierPhone: order.carrierPhone,
        carrierContactName: order.carrierContactName,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        stripeCheckoutSessionId: order.stripeCheckoutSessionId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Order creation error:', error);
    const message = error?.message || 'Failed to create order';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause based on user role and query parameters
    let whereClause: any = {};

    // If user is a client, only show their own orders
    if (session.user.role === 'client') {
      whereClause.clientId = parseInt(session.user.id);
    } else if (clientId) {
      // Admins and agents can filter by clientId
      whereClause.clientId = parseInt(clientId);
    }
    // Admins and agents can see all orders (no clientId filter when not specified)

    if (status) {
      whereClause.status = status;
    }

    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    try {
      const orders = await prisma.orders.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      });

      const totalCount = await prisma.orders.count({
        where: whereClause,
      });

      return NextResponse.json({
        success: true,
        data: orders,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      });
    } catch (dbError: any) {
      console.error('Database error fetching orders:', dbError);
      // If table doesn't exist, return empty array instead of error
      if (dbError.code === 'P2021' || dbError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
        });
      }
      throw dbError;
    }

  } catch (error: any) {
    console.error('Order retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve orders' },
      { status: 500 }
    );
  }
}




