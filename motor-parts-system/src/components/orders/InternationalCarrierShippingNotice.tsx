import { formatCurrency } from '@/lib/utils';
import {
  INTERNATIONAL_CARRIER_BASE_FEE_USD,
  INTERNATIONAL_CARRIER_INCLUDED_LBS,
  INTERNATIONAL_CARRIER_PER_EXTRA_LB_USD,
} from '@/lib/international-carrier-surcharge';
import { PAYMENT_TRANSFER_DETAILS } from '@/lib/order-details-constants';

type InternationalCarrierShippingNoticeProps = {
  totalWeightLbs: number;
  surchargeFeeUsd: number;
  lineSubtotalUsd: number;
  grandTotalUsd: number;
  /** True if at least one line has qty > 0 but no weight per unit (treated as 0 lb). */
  hasMissingWeightOnSomeLines: boolean;
};

/**
 * Client-facing copy (Spanish) for Miami carrier delivery fee and 6-mile radius rule.
 */
export function InternationalCarrierShippingNotice({
  totalWeightLbs,
  surchargeFeeUsd,
  lineSubtotalUsd,
  grandTotalUsd,
  hasMissingWeightOnSomeLines,
}: InternationalCarrierShippingNoticeProps) {
  return (
    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-gray-800 space-y-2">
      <p className="font-semibold text-blue-900">Cargo por envío a transportador (Miami)</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Peso total estimado de la orden:{' '}
          <span className="font-medium">{totalWeightLbs.toFixed(2)} lb</span>
          {hasMissingWeightOnSomeLines && (
            <span className="text-amber-800">
              {' '}
              (algunas referencias no tienen peso en sistema; se contaron como 0 lb)
            </span>
          )}
        </li>
        <li>
          Tarifa: {formatCurrency(INTERNATIONAL_CARRIER_BASE_FEE_USD, 'USD')} mínimo hasta{' '}
          {INTERNATIONAL_CARRIER_INCLUDED_LBS} lb + {formatCurrency(INTERNATIONAL_CARRIER_PER_EXTRA_LB_USD, 'USD')}{' '}
          por cada lb adicional.
        </li>
        <li>
          <span className="font-medium">Cargo adicional aplicado: {formatCurrency(surchargeFeeUsd, 'USD')}</span>
        </li>
      </ul>
      <p className="text-xs leading-relaxed text-gray-700 border-t border-blue-100 pt-2">
        Este cargo solo aplica para entregas dentro de un radio de <strong>6 millas</strong> alrededor de nuestra
        dirección en Miami ({PAYMENT_TRANSFER_DETAILS.beneficiaryAddress}). Fuera de ese radio pueden aplicar otros
        costos o condiciones acordadas aparte.
      </p>
      <div className="flex flex-col gap-0.5 text-sm pt-1 border-t border-blue-100">
        <div className="flex justify-between">
          <span>Subtotal ítems</span>
          <span className="font-medium">{formatCurrency(lineSubtotalUsd, 'USD')}</span>
        </div>
        <div className="flex justify-between">
          <span>Cargo envío (Miami)</span>
          <span className="font-medium">{formatCurrency(surchargeFeeUsd, 'USD')}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-gray-900 pt-1">
          <span>Total orden</span>
          <span>{formatCurrency(grandTotalUsd, 'USD')}</span>
        </div>
      </div>
    </div>
  );
}
