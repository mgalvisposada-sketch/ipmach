import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe-service';
/**
 * Loads a Checkout Session from Stripe and, if payment is complete, marks the linked order as paid.
 * Used by return URL (GET) and confirm-session (POST).
 */
export async function markOrderPaidFromCheckoutSessionId(sessionId: string): Promise<{
  orderId: number;
  updated: boolean;
  paymentStatus: string;
}> {
  if (!sessionId.startsWith('cs_')) {
    throw new Error('Invalid Checkout Session id');
  }

  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });

  const orderId = Number(
    checkoutSession.metadata?.orderId ?? checkoutSession.client_reference_id
  );
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error('Order not linked to this Checkout Session');
  }

  const piId =
    typeof checkoutSession.payment_intent === 'string'
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent &&
          typeof checkoutSession.payment_intent === 'object' &&
          'id' in checkoutSession.payment_intent
        ? String((checkoutSession.payment_intent as { id: string }).id)
        : null;

  let updated = false;
  if (checkoutSession.payment_status === 'paid') {
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        paymentMethod: 'stripe',
        paymentStatus: 'paid',
        stripeCheckoutSessionId: checkoutSession.id,
        stripePaymentIntentId: piId,
      },
    });
    updated = true;
  }

  return {
    orderId,
    updated,
    paymentStatus: checkoutSession.payment_status,
  };
}
