import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import {
  getExternalPendingByClientUserId,
  extractBilledMotorOrderIds,
  getAllFilipoOrdersForMatching,
} from '@/lib/external-billing';
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
import { pushOrderToFilipo } from '@/lib/filipo-sync';

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

// pushOrderToDocuments and helpers were moved to @/lib/filipo-sync as pushOrderToFilipo

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
        incoterm: true,
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

    // For clients with credit: enforce limit vs external portfolio debt (Filipo sales) only — not platform orders
    let externalDebt = 0;
    let availableCredit: number | null = null;
    if (hasCreditLine) {
      const ext = await getExternalPendingByClientUserId(validatedClientId);
      externalDebt = ext.pendingAmount;
      availableCredit = Math.max(0, creditLimitNum - externalDebt);
      if (validatedTotalAmount > availableCredit) {
        return NextResponse.json(
          {
            error: `No puede generar la orden. Su deuda general (${externalDebt.toFixed(2)} USD) supera o iguala su límite de crédito (${creditLimitNum.toFixed(2)} USD) con el monto de este pedido. Cupo disponible: ${availableCredit.toFixed(2)} USD. Regularice su cuenta para continuar.`,
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

    pushOrderToFilipo(order, client).catch(() => {});

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

      const globalFilipoMap = await getAllFilipoOrdersForMatching();

      const ordersWithFilipo = orders.map((o) => {
        const filipoInfo = globalFilipoMap.get(o.id) ?? null;
        const filipoTotal = filipoInfo?.total ?? null;
        const filipoBilled = filipoInfo?.billed ?? false;
        const filipoExists = filipoInfo != null;
        return { ...o, filipoBilled, filipoTotal, filipoExists };
      });

      const totalCount = await prisma.orders.count({
        where: whereClause,
      });

      return NextResponse.json({
        success: true,
        data: ordersWithFilipo,
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




