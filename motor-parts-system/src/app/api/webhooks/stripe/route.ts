import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    const alreadyProcessed = await prisma.stripeWebhookEvents.findUnique({
      where: { eventId: event.id },
    });
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, deduplicated: true });
    }

    await prisma.stripeWebhookEvents.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        status: 'processing',
      },
    });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = Number(session.metadata?.orderId ?? session.client_reference_id);
      if (
        Number.isInteger(orderId) &&
        orderId > 0 &&
        session.payment_status === 'paid'
      ) {
        await prisma.orders.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'paid',
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent &&
                    typeof session.payment_intent === 'object' &&
                    'id' in session.payment_intent
                  ? String((session.payment_intent as { id: string }).id)
                  : null,
          },
        });
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = Number(pi.metadata?.orderId);
      if (Number.isInteger(orderId) && orderId > 0) {
        await prisma.orders.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'paid',
            stripePaymentIntentId: pi.id,
          },
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = Number(paymentIntent.metadata?.orderId);
      if (Number.isInteger(orderId) && orderId > 0) {
        await prisma.orders.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'failed',
            stripePaymentIntentId: paymentIntent.id,
          },
        });
      }
    }

    await prisma.stripeWebhookEvents.update({
      where: { eventId: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Webhook processing failed' },
      { status: 400 }
    );
  }
}
