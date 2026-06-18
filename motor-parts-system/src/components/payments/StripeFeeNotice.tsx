'use client';

import {
  computeStripeGrossUpUsd,
  STRIPE_SURCHARGE_PERCENT,
  STRIPE_SURCHARGE_FIXED_USD,
} from '@/lib/stripe-surcharge';
import { formatCurrency } from '@/lib/utils';

type Props = {
  /** Order subtotal in USD (items total before card fee gross-up). */
  orderTotalUsd: number;
  /** When true, copy refers to "convert quote to order" instead of "confirm order". */
  variant?: 'create-order' | 'convert-quote';
};

/**
 * Explains Stripe Checkout redirect and shows gross-up: 4.4% + $0.30 passed to the customer.
 */
export function StripeFeeNotice({ orderTotalUsd, variant = 'create-order' }: Props) {
  const g = computeStripeGrossUpUsd(orderTotalUsd);
  const percentLabel = `${(STRIPE_SURCHARGE_PERCENT * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
  const fixedLabel = STRIPE_SURCHARGE_FIXED_USD.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const decimalLabel = STRIPE_SURCHARGE_PERCENT.toLocaleString('es-CO', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const nextStep =
    variant === 'convert-quote'
      ? 'Al convertir a orden, se creará el pedido y lo enviaremos a una página segura de Stripe para ingresar los datos de la tarjeta (no se capturan en esta pantalla).'
      : 'Al pulsar Confirmar y crear orden, se guardará la orden y lo enviaremos a una página segura de Stripe. Allí ingresará los datos de la tarjeta (no se capturan en esta pantalla por seguridad).';

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-900 space-y-2">
      <p className="font-medium">Pago con tarjeta (Stripe)</p>
      <p>{nextStep}</p>
      <div className="border-t border-blue-200 pt-2 space-y-1">
        <p>
          <span className="font-medium">Importe del pedido:</span>{' '}
          {formatCurrency(g.originalUsd, 'USD')}
        </p>
        <p>
          <span className="font-medium">Ajuste por uso de la plataforma (aprox.):</span>{' '}
          {formatCurrency(g.surchargeUsd, 'USD')}
        </p>
        <p className="text-base font-semibold text-blue-950">
          <span className="font-medium">Total a cobrar en Stripe:</span>{' '}
          {formatCurrency(g.totalFinalUsd, 'USD')}
        </p>
      </div>
      <p className="text-xs text-blue-800 leading-relaxed">
        El cargo con tarjeta incluye un ajuste calculado para cubrir la comisión ({percentLabel} +{' '}
        {`US$${fixedLabel}`} por transacción), de modo que el valor del pedido quede cubierto. Fórmula: total = (importe +{' '}
        {`US$${fixedLabel}`}) / (1 − {decimalLabel}).
      </p>
      <p className="text-blue-800">Después del pago volverá a la lista de órdenes.</p>
    </div>
  );
}
