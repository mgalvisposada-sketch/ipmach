import { getExternalBillingForClientUserId, type ExternalBillingDocument } from '@/lib/external-billing';
import { getFilipoClientCreditForUserId } from '@/lib/filipo-client-credit';
import { PORTFOLIO_OVERDUE_GRACE_DAYS } from '@/lib/portfolio-credit-terms';

const PENDING_EPSILON = 0.005;

function utcDayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDocumentDayStartMs(freg: string): number | null {
  const d = new Date(freg);
  if (Number.isNaN(d.getTime())) return null;
  return utcDayStartMs(d);
}

/**
 * Documents with pending balance: due date = document date (freg) + paymentTermDays (calendar).
 * Block if today is more than PORTFOLIO_OVERDUE_GRACE_DAYS after due date.
 */
export function evaluatePortfolioOverdueBlock(
  documents: ExternalBillingDocument[] | undefined,
  paymentTermDays: number,
  referenceDate: Date = new Date()
): { blocked: boolean; overdueCount: number; overdueRefs: string[] } {
  const overdueRefs: string[] = [];
  if (!documents?.length) {
    return { blocked: false, overdueCount: 0, overdueRefs };
  }

  const todayMs = utcDayStartMs(referenceDate);
  const termMs = paymentTermDays * 86_400_000;

  for (const doc of documents) {
    const pending = typeof doc.pending === 'number' ? doc.pending : 0;
    if (pending <= PENDING_EPSILON) continue;
    if (!doc.freg) continue;
    const issueMs = parseDocumentDayStartMs(doc.freg);
    if (issueMs == null) continue;
    const dueMs = issueMs + termMs;
    const daysPastDue = Math.floor((todayMs - dueMs) / 86_400_000);
    if (daysPastDue > PORTFOLIO_OVERDUE_GRACE_DAYS) {
      const ref = doc.externalId != null ? String(doc.externalId) : doc.id;
      overdueRefs.push(ref);
    }
  }

  return {
    blocked: overdueRefs.length > 0,
    overdueCount: overdueRefs.length,
    overdueRefs,
  };
}

export type PortfolioBlockState = {
  blocked: boolean;
  overdueCount: number;
  overdueRefs: string[];
  message?: string;
};

/**
 * Portfolio control for clients with an active credit line.
 * On billing API failure, returns blocked: false (same fail-open policy as external debt amount).
 */
export async function getPortfolioBlockStateForClientUserId(
  userId: number,
  options?: { filipoCreditDaysLimit?: number | null }
): Promise<PortfolioBlockState> {
  const filipo = await getFilipoClientCreditForUserId(userId);
  if (!filipo?.creditEnabled) {
    return { blocked: false, overdueCount: 0, overdueRefs: [] };
  }

  const filipoDays =
    options?.filipoCreditDaysLimit !== undefined
      ? options.filipoCreditDaysLimit
      : filipo.creditDaysLimit;
  const termDays = filipoDays === null ? 30 : filipoDays;
  if (!Number.isFinite(termDays) || termDays <= 0) {
    return { blocked: false, overdueCount: 0, overdueRefs: [] };
  }

  const billing = await getExternalBillingForClientUserId(userId, 'documents');
  if (billing.error || !billing.payload) {
    return { blocked: false, overdueCount: 0, overdueRefs: [] };
  }

  const { blocked, overdueCount, overdueRefs } = evaluatePortfolioOverdueBlock(
    billing.payload.documents,
    termDays
  );

  if (!blocked) {
    return { blocked: false, overdueCount: 0, overdueRefs: [] };
  }

  return {
    blocked: true,
    overdueCount,
    overdueRefs,
    message:
      `No puede generar órdenes de compra: tiene documentos en cartera vencidos (más de ${PORTFOLIO_OVERDUE_GRACE_DAYS} días después del plazo de pago). ` +
      `Regularice su cartera para continuar. Documentos en mora: ${overdueRefs.length}.`,
  };
}
