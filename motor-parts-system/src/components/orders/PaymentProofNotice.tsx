'use client';

import { ORDER_PAYMENT_PROOF_EMAIL } from '@/lib/order-details-constants';

/**
 * Shown when payment is bank transfer or Zelle: client must email proof with order number.
 */
export function PaymentProofNotice() {
    return (
        <div
            className="mt-3 rounded-md border-2 border-amber-400 bg-amber-50 p-2.5 text-xs sm:text-sm text-amber-950 shadow-sm"
            role="status"
        >
            <p className="font-semibold">Pago por transferencia o Zelle</p>
            <p className="mt-1.5 leading-snug">
                Puede <strong>confirmar y crear la orden</strong> con el botón de abajo. Envíe el comprobante a{' '}
                <a
                    href={`mailto:${ORDER_PAYMENT_PROOF_EMAIL}?subject=Comprobante de pago — Orden`}
                    className="font-medium text-blue-800 underline break-all"
                >
                    {ORDER_PAYMENT_PROOF_EMAIL}
                </a>{' '}
                indicando el <strong>número de orden</strong> en cualquier momento después. La orden{' '}
                <strong>no se procesa</strong> hasta validar el pago.
            </p>
        </div>
    );
}
