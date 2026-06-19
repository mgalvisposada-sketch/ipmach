/**
 * Email domains that cannot receive inbound mail (e.g. Null MX / no usable MX).
 * Prevents signups and welcome emails that would always bounce.
 */
const NON_RECEIVING_DOMAINS = new Set(['proshel.com']);

export function isNonReceivingEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return domain ? NON_RECEIVING_DOMAINS.has(domain) : false;
}
