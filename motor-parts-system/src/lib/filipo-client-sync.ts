/**
 * Filipo Client Sync
 * Pushes client data to Filipo-Web via /api/v1/customers.
 * POST = create (or upsert fallback), PUT = update existing.
 * Uses DOCUMENTS_API_BASE_URL and DOCUMENTS_API_TOKEN env vars (same as orders/billing).
 * Never throws; returns a result object for fail-open callers.
 */

const SYNC_TIMEOUT_MS = 15_000;

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

export type FilipoSyncPayload = {
  externalId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string | null;
  /** Filipo `clients.credit_enabled` — only sent when `syncCredit` is true. */
  creditEnabled?: boolean;
  /** Filipo `clients.credit_limit` (USD). */
  creditLimit?: number;
  /** Filipo `clients.credit_days_limit` (0 = no cap). Omit to leave unchanged on Filipo update. */
  creditDaysLimit?: number;
};

export type FilipoSyncCreditOptions = {
  /** When true, sends `creditEnabled` and `creditLimit` from the motor user record. */
  syncCredit: boolean;
  /**
   * When set (including 0), sends `creditDaysLimit` to Filipo. When omitted, Filipo keeps existing days on update.
   */
  creditDaysLimit?: number | null;
};

export type FilipoSyncResult = {
  ok: boolean;
  created?: boolean;
  clientId?: string;
  error?: string;
};

function getConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
  const token = process.env.DOCUMENTS_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

/**
 * Build normalized payload from motor-parts user fields.
 * Uses identification as externalId; falls back to CLI{userId} when identification is empty.
 * Returns null only if neither identification nor userId is available.
 */
export function buildFilipoSyncPayload(
  user: {
    userId?: number | null;
    identification?: string | null;
    clientName?: string | null;
    username?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    phoneCountryCode?: string | null;
    address?: string | null;
    city?: string | null;
    stateOrDepartment?: string | null;
    country?: string | null;
    hasCredit?: boolean | null;
    creditLimit?: unknown;
  },
  creditOptions?: FilipoSyncCreditOptions
): FilipoSyncPayload | null {
  const externalId = user.identification?.trim() || (user.userId ? `CLI${user.userId}` : '');
  if (!externalId) return null;

  const name = (user.clientName?.trim() || user.username?.trim() || user.email?.trim() || 'Cliente').slice(0, 255);
  const phone = [user.phoneCountryCode?.trim(), user.phoneNumber?.trim()].filter(Boolean).join(' ') || null;

  const payload: FilipoSyncPayload = {
    externalId,
    name,
    email: user.email?.trim().toLowerCase() || null,
    phone,
    address: user.address?.trim() || null,
    city: user.city?.trim() || null,
    department: user.stateOrDepartment?.trim() || null,
    country: user.country?.trim() || null,
  };

  if (creditOptions?.syncCredit) {
    payload.creditEnabled = Boolean(user.hasCredit);
    const lim = user.creditLimit != null ? Number(user.creditLimit) : 0;
    payload.creditLimit = Number.isFinite(lim) && lim >= 0 ? lim : 0;
    if (creditOptions.creditDaysLimit !== undefined) {
      const d =
        creditOptions.creditDaysLimit === null
          ? 0
          : Math.max(0, Math.floor(Number(creditOptions.creditDaysLimit)));
      payload.creditDaysLimit = Number.isFinite(d) ? d : 0;
    }
  }

  return payload;
}

/**
 * Push client to Filipo-Web (fire-and-forget safe).
 * @param method - 'POST' for create/upsert, 'PUT' for update-only (404 if not found).
 * Never throws. On failure returns { ok: false, error }.
 */
export async function syncClientToFilipo(
  payload: FilipoSyncPayload,
  method: 'POST' | 'PUT' = 'POST'
): Promise<FilipoSyncResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, error: 'Filipo sync not configured (DOCUMENTS_API_BASE_URL / DOCUMENTS_API_TOKEN missing)' };
  }

  const url = `${config.baseUrl}/api/v1/customers`;

  if (process.env.NODE_ENV === 'development') {
    console.info(`[filipo-client-sync] ${method}`, url, 'externalId=', payload.externalId);
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method,
        headers: {
          'X-API-Token': config.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      SYNC_TIMEOUT_MS
    );

    const text = await res.text();
    let data: { error?: { message?: string } | null; data?: { clientId?: string; created?: boolean } } | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: `Invalid JSON from Filipo: ${text.substring(0, 200)}` };
    }

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      console.warn(`[filipo-client-sync] ${method} failed:`, res.status, errMsg);
      return { ok: false, error: errMsg };
    }

    return {
      ok: true,
      created: data?.data?.created ?? undefined,
      clientId: data?.data?.clientId ?? undefined,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorMsg = isAbort ? `Request timed out after ${SYNC_TIMEOUT_MS / 1000}s` : (err instanceof Error ? err.message : 'Unknown error');
    console.warn(`[filipo-client-sync] ${method} error:`, errorMsg);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Convenience: build payload from user fields and sync in one call.
 * @param method - 'POST' for create/upsert (default), 'PUT' for update-only.
 * Returns the sync result. Logs warnings on failure but never throws.
 */
export async function syncMotorUserToFilipo(
  user: {
    userId?: number | null;
    identification?: string | null;
    clientName?: string | null;
    username?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    phoneCountryCode?: string | null;
    address?: string | null;
    city?: string | null;
    stateOrDepartment?: string | null;
    country?: string | null;
    hasCredit?: boolean | null;
    creditLimit?: unknown;
  },
  creditOptions?: FilipoSyncCreditOptions,
  method: 'POST' | 'PUT' = 'POST'
): Promise<FilipoSyncResult> {
  const payload = buildFilipoSyncPayload(user, creditOptions);
  if (!payload) {
    return { ok: false, error: 'Cannot sync to Filipo: identification or userId is required' };
  }
  return syncClientToFilipo(payload, method);
}
