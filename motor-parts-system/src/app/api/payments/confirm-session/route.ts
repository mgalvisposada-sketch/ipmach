import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { markOrderPaidFromCheckoutSessionId } from '@/lib/stripe-mark-order-paid';

export const dynamic = 'force-dynamic';

/**
 * Confirms payment (client-side fallback) when session_id is present on /orders but GET return was skipped.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const result = await markOrderPaidFromCheckoutSessionId(sessionId);

    const order = await prisma.orders.findUnique({ where: { id: result.orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (session.user.role === 'client' && Number(session.user.id) !== order.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      paymentStatus: result.updated ? 'paid' : result.paymentStatus,
      orderId: result.orderId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Confirm failed';
    console.error('[Stripe confirm-session]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
