/**
 * Reads per-client credit from Filipo-Web (clients.credit_*).
 * Motor-parts does not store credit limit or credit flags locally.
 */

import { prisma } from '@/lib/prisma';

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function getDocumentsApiConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

/**
 * Resolves Filipo external id for a motor user (same as billing / client sync).
 */
export function getMotorClientExternalId(user: {
  id: number;
  identification?: string | null;
}): string {
  const id = user.identification?.trim();
  return id || `CLI${user.id}`;
}

export type FilipoClientCredit = {
  /** Maps to `clients.credit_enabled`. */
  creditEnabled: boolean;
  /** Maps to `clients.credit_limit` (USD). */
  creditLimit: number;
  /** Maps to `clients.credit_days_limit` (0 = no day cap). */
  creditDaysLimit: number;
};

type CustomersApiRow = {
  creditDaysLimit?: unknown;
  creditEnabled?: unknown;
  creditLimit?: unknown;
};

function parseCustomerRow(row: CustomersApiRow): FilipoClientCredit {
  const creditEnabled = Boolean(row.creditEnabled);
  const limRaw = row.creditLimit;
  const lim =
    typeof limRaw === 'number'
      ? limRaw
      : limRaw != null && limRaw !== ''
        ? Number(limRaw)
        : 0;
  const creditLimit = Number.isFinite(lim) && lim >= 0 ? lim : 0;
  const daysRaw = row.creditDaysLimit;
  const days =
    typeof daysRaw === 'number'
      ? daysRaw
      : daysRaw != null && daysRaw !== ''
        ? Number(daysRaw)
        : 0;
  const creditDaysLimit = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  return { creditEnabled, creditLimit, creditDaysLimit };
}

/**
 * Returns Filipo credit snapshot for a motor user, or null if API fails or customer is missing in Filipo.
 */
export async function getFilipoClientCreditForUserId(userId: number): Promise<FilipoClientCredit | null> {
  const config = getDocumentsApiConfig();
  if (!config) {
    console.info(
      '[filipo-client-credit] Skipped Filipo GET /customers: DOCUMENTS_API_BASE_URL or DOCUMENTS_API_TOKEN missing'
    );
    return null;
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, identification: true },
  });
  if (!user) return null;

  const externalId = getMotorClientExternalId(user);
  const url = new URL(`${config.baseUrl}/api/v1/customers`);
  url.searchParams.set('identification', externalId);

  console.info(
    '[filipo-client-credit] External request: GET',
    url.toString(),
    '| motorUserId=',
    userId,
    '| query identification=',
    externalId
  );

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: { 'X-API-Token': config.token },
      },
      FETCH_TIMEOUT_MS
    );

    const text = await res.text();
    let body: { data?: CustomersApiRow[]; error?: { message?: string } | null } | null = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return null;
    }

    if (!res.ok) {
      const msg = body?.error?.message || res.statusText;
      console.warn('[filipo-client-credit] GET /customers failed:', res.status, msg);
      return null;
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    const first = rows[0];
    if (!first || typeof first !== 'object') {
      console.info(
        '[filipo-client-credit] GET /customers 200 but no customer row | motorUserId=',
        userId,
        '| identification=',
        externalId
      );
      return null;
    }

    const parsed = parseCustomerRow(first as CustomersApiRow);
    console.info(
      '[filipo-client-credit] GET /customers ok | motorUserId=',
      userId,
      '| creditEnabled=',
      parsed.creditEnabled,
      '| creditLimit=',
      parsed.creditLimit,
      '| creditDaysLimit=',
      parsed.creditDaysLimit
    );
    return parsed;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(
      '[filipo-client-credit] Error fetching client credit:',
      isAbort ? 'timeout' : err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Returns Filipo `creditDaysLimit` only. Null if unavailable or customer missing.
 */
export async function getFilipoCreditDaysLimitForClientUserId(
  userId: number
): Promise<number | null> {
  const row = await getFilipoClientCreditForUserId(userId);
  return row ? row.creditDaysLimit : null;
}
