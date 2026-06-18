import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/stripe-service';
import { markOrderPaidFromCheckoutSessionId } from '@/lib/stripe-mark-order-paid';

export const dynamic = 'force-dynamic';

/**
 * Stripe Checkout success_url: browser hits this GET after payment.
 * Marks the order paid server-side (no client fetch, no webhook required for UX).
 * Public route: trust Stripe session_id + server-side Stripe API verification.
 */
export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl();
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId?.startsWith('cs_')) {
    return NextResponse.redirect(new URL('/orders?payment=invalid', baseUrl));
  }

  try {
    const result = await markOrderPaidFromCheckoutSessionId(sessionId);
    const qs = new URLSearchParams({
      payment: result.updated ? 'success' : 'pending',
      orderId: String(result.orderId),
    });
    return NextResponse.redirect(new URL(`/orders?${qs.toString()}`, baseUrl));
  } catch (error: unknown) {
    console.error('[Stripe stripe-return]', error);
    return NextResponse.redirect(new URL('/orders?payment=error', baseUrl));
  }
}
