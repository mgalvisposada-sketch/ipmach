import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrl, getStripeClient } from '@/lib/stripe-service';
import { computeStripeGrossUpUsd, formatUsd } from '@/lib/stripe-surcharge';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const orderId = Number(body?.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (session.user.role === 'client' && Number(session.user.id) !== order.clientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'Order is already paid.' }, { status: 400 });
    }

    const baseUrl = getAppBaseUrl();
    const stripe = getStripeClient();

    if (order.stripeCheckoutSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
        if (existing.url && existing.status === 'open') {
          return NextResponse.json({ success: true, checkoutUrl: existing.url });
        }
      } catch (retrieveErr: unknown) {
        const err = retrieveErr as { code?: string; message?: string; type?: string };
        const msg = typeof err.message === 'string' ? err.message : '';
        const isMissingSession =
          err.code === 'resource_missing' || msg.includes('No such checkout.session');
        if (isMissingSession) {
          console.warn(
            '[Stripe Checkout] Could not reuse session (wrong mode, expired, or deleted). Creating a new one. Old id:',
            order.stripeCheckoutSessionId
          );
        } else {
          throw retrieveErr;
        }
      }
    }
    const orderTotalUsd = Number(order.totalAmount);
    const gross = computeStripeGrossUpUsd(orderTotalUsd);
    const amountCents = Math.round(gross.totalFinalUsd * 100);
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Order total amount must be greater than zero.' }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${baseUrl}/api/payments/stripe-return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/orders?payment=cancel&orderId=${order.id}`,
      client_reference_id: String(order.id),
      customer_email: order.client.email ?? undefined,
      metadata: {
        orderId: String(order.id),
        clientId: String(order.clientId),
        orderSubtotalUsd: gross.originalUsd.toFixed(2),
        stripeChargeUsd: gross.totalFinalUsd.toFixed(2),
      },
      payment_intent_data: {
        metadata: {
          orderId: String(order.id),
          clientId: String(order.clientId),
          orderSubtotalUsd: gross.originalUsd.toFixed(2),
          stripeChargeUsd: gross.totalFinalUsd.toFixed(2),
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `Order #${order.id}`,
              description:
                (order.orderName ? `${order.orderName} — ` : '') +
                `Subtotal ${formatUsd(gross.originalUsd)}; total charged ${formatUsd(gross.totalFinalUsd)} (incl. card processing fee)`,
            },
          },
        },
      ],
    });

    await prisma.orders.update({
      where: { id: order.id },
      data: {
        paymentMethod: 'stripe',
        paymentStatus: 'pending_payment',
        stripeCheckoutSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id,
    });
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Could not create Stripe Checkout session' },
      { status: 500 }
    );
  }
}
