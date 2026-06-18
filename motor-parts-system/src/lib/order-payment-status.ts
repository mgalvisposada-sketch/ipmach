import { PAYMENT_METHOD_CREDIT_LINE, PAYMENT_METHOD_STRIPE } from '@/lib/order-details-constants';

export type PaymentSummaryVariant = 'paid' | 'pending' | 'failed';

/**
 * Human-readable payment line for order lists and detail (UI copy in Spanish).
 */
export function getOrderPaymentSummaryLine(order: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
}): { label: string; variant: PaymentSummaryVariant } {
  const pm = order.paymentMethod ?? '';
  const ps = order.paymentStatus ?? '';

  if (pm === PAYMENT_METHOD_STRIPE) {
    if (ps === 'paid') {
      return { label: 'Pagado (Stripe)', variant: 'paid' };
    }
    if (ps === 'failed') {
      return { label: 'Pago fallido', variant: 'failed' };
    }
    return { label: 'Pendiente de pago', variant: 'pending' };
  }

  if (ps === 'paid') {
    return { label: 'Pagado', variant: 'paid' };
  }

  if (pm === PAYMENT_METHOD_CREDIT_LINE && ps === 'not_required') {
    return { label: 'Pendiente de pago (crédito)', variant: 'pending' };
  }

  return { label: 'Pendiente de pago', variant: 'pending' };
}
