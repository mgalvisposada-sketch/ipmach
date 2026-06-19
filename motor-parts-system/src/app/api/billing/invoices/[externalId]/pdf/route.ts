import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchFilipoInvoiceDetailForPdf } from '@/lib/filipo-document-detail';
import { generateOrderPdfBuffer, type ClientForPdf, type OrderForPdf } from '@/lib/order-pdf';

export const dynamic = 'force-dynamic';

/** PDF fields only — `incoterm` is read separately so stale Prisma clients do not break the route. */
const CLIENT_SELECT = {
  id: true,
  username: true,
  email: true,
  phoneNumber: true,
  address: true,
  city: true,
  stateOrDepartment: true,
  country: true,
  clientName: true,
  identification: true,
} as const;

async function fetchUserIncotermById(userId: number): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ incoterm: string | null }>>(
      Prisma.sql`SELECT "incoterm" FROM "Users" WHERE "id" = ${userId} LIMIT 1`
    );
    return rows[0]?.incoterm ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/billing/invoices/[externalId]/pdf?type=sale|remision
 * Builds PDF locally with pdf-lib (never proxies Filipo binary PDF). Loads JSON document detail when
 * available; otherwise falls back to the same invoices list API as /facturas (summary line).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ externalId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'client' && role !== 'admin' && role !== 'agent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
    const token = process.env.DOCUMENTS_API_TOKEN?.trim();
    if (!baseUrl || !token) {
      return NextResponse.json({ error: 'Billing service not configured' }, { status: 503 });
    }

    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { externalId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || (type !== 'sale' && type !== 'remision')) {
      return NextResponse.json(
        { error: 'Query parameter type=sale or type=remision is required' },
        { status: 400 }
      );
    }

    let filipoClientId: string | null = null;
    if (role === 'client') {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, identification: true },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      filipoClientId = user.identification?.trim() || `CLI${user.id}`;
    } else {
      filipoClientId = searchParams.get('clientId')?.trim() ?? null;
    }

    const filipo = await fetchFilipoInvoiceDetailForPdf({
      externalId,
      type,
      clientId: filipoClientId,
    });

    if (!filipo.ok) {
      const status =
        filipo.status === 403 || filipo.status === 404
          ? filipo.status
          : filipo.status === 422
            ? 422
            : filipo.status && filipo.status >= 500
              ? 502
              : 502;
      return NextResponse.json({ error: filipo.error }, { status });
    }

    const { detail } = filipo;

    let motorClient: ClientForPdf | null = null;
    let motorClientName: string | null = null;
    if (role === 'client') {
      const u = await prisma.users.findUnique({
        where: { id: userId },
        select: CLIENT_SELECT,
      });
      if (u) {
        motorClientName = u.clientName ?? u.username;
        const incoterm = await fetchUserIncotermById(u.id);
        motorClient = {
          id: u.id,
          username: u.username,
          email: u.email,
          phoneNumber: u.phoneNumber,
          address: u.address,
          city: u.city,
          stateOrDepartment: u.stateOrDepartment,
          country: u.country,
          incoterm,
        };
      }
    } else if (filipoClientId) {
      const u = await prisma.users.findFirst({
        where: { identification: filipoClientId },
        select: CLIENT_SELECT,
      });
      if (u) {
        motorClientName = u.clientName ?? u.username;
        const incoterm = await fetchUserIncotermById(u.id);
        motorClient = {
          id: u.id,
          username: u.username,
          email: u.email,
          phoneNumber: u.phoneNumber,
          address: u.address,
          city: u.city,
          stateOrDepartment: u.stateOrDepartment,
          country: u.country,
          incoterm,
        };
      }
    }

    const itemsPayload = detail.items.map((it) => ({
      reference: it.reference,
      description: it.description,
      brand: it.brand,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
    }));

    const numericRef = Number(externalId);
    const pseudoOrderId = Number.isFinite(numericRef) ? Math.floor(numericRef) : userId;

    const displayName = detail.clientName ?? motorClientName;

    const orderForPdf: OrderForPdf = {
      id: pseudoOrderId,
      clientId: motorClient?.id ?? userId,
      clientName: displayName,
      items: itemsPayload,
      status: 'completed',
      createdAt: detail.documentDate,
      totalAmount: detail.totalsOverride?.total ?? 0,
      discountPercent: detail.totalsOverride?.discountPercent ?? 0,
      discountAmount: detail.totalsOverride?.discountAmount ?? 0,
      observations: detail.observations,
      orderName: null,
      dispatchType: null,
      pickupEntity: null,
      pickupName: null,
      carrierName: null,
      carrierAddress: null,
      carrierPhone: null,
      carrierContactName: null,
      paymentMethod: null,
    };

    const clientForPdf: ClientForPdf | null = motorClient ?? {
      username: detail.clientName || 'Cliente',
      email: null,
      phoneNumber: null,
      address: null,
      city: null,
      stateOrDepartment: null,
      country: null,
    };

    const headerTitle = type === 'sale' ? 'Invoice' : 'Delivery note';

    const buffer = await generateOrderPdfBuffer(orderForPdf, clientForPdf, {
      printReference: true,
      headerTitle,
      detailsSectionTitle: 'Document details',
      documentNumberLabel: 'Reference:',
      documentNumberValue: externalId,
      dateLabel: 'Date:',
      rightDetailCaption: 'Subject to applicable commercial terms',
      showDispatchAndPaymentDetails: false,
      totalsOverride: detail.totalsOverride,
    });

    const safeName = String(externalId).replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[billing/invoices/pdf] Error:', err);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
