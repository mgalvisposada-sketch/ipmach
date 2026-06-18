/**
 * Static copy for order details: bank transfer beneficiary and Zelle.
 * Used in OrderBuilder and quote-to-order modal.
 */
export const PAYMENT_TRANSFER_DETAILS = {
  beneficiaryName: 'IPROSHEL CORP (DBA: INTERNATIONAL PARTS MACHINERY)',
  beneficiaryAddress: '7768 NW 64 St, Miami Fl, 33166',
  bankName: 'Bank Of America',
  accountNumber: '8981 0147 4271',
  swift: 'BOFAUS3N',
  routingAba: '026009593',
} as const;

export const ZELLE_EMAIL = 'ipmach@ipmach.com';

/** Clients must email payment proof here (transfer / Zelle) so the order can be processed. */
export const ORDER_PAYMENT_PROOF_EMAIL = 'proshel@proshelcorp.com';

export const DISPATCH_TYPE_PICKUP = 'pickup';
export const DISPATCH_TYPE_INTERNATIONAL_CARRIER = 'international_carrier';

/** Stored in Orders.pickupEntity when dispatch is pickup (warehouse pickup). */
export const PICKUP_ENTITY_PERSON = 'Persona';
export const PICKUP_ENTITY_COMPANY = 'Empresa';

export function isValidPickupEntity(value: string | null | undefined): boolean {
  const v = (value ?? '').toString().trim();
  return v === PICKUP_ENTITY_PERSON || v === PICKUP_ENTITY_COMPANY;
}

export const PAYMENT_METHOD_CREDIT_LINE = 'credit_line';
export const PAYMENT_METHOD_TRANSFER = 'transfer';
export const PAYMENT_METHOD_ZELLE = 'zelle';
export const PAYMENT_METHOD_STRIPE = 'stripe';
