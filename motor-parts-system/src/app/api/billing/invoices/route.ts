import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DOCUMENTS_API_TIMEOUT_MS = 30_000;

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

/** Same headers as manual validation: curl ... -H "X-API-Token: ..." (plus Accept JSON). */
const UPSTREAM_INVOICES_HEADERS = (token: string): HeadersInit => ({
  Accept: 'application/json',
  'X-API-Token': token,
});

function isHtmlResponse(contentType: string | null, body: string): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html')) return true;
  const t = body.slice(0, 200).trim().toLowerCase();
  return t.startsWith('<!doctype html') || t.startsWith('<html');
}

function upstreamRouteMissingMessage(
  requestUrl: string,
  status: number,
  contentType: string | null
): { error: string; details: Record<string, unknown> } {
  const base = (() => {
    try {
      return new URL(requestUrl).origin;
    } catch {
      return '(invalid URL)';
    }
  })();
  return {
    error:
      'Documents API returned HTML instead of JSON. The invoices route was not found on the upstream Next.js app (404 page).',
    details: {
      upstreamStatus: status,
      upstreamUrl: requestUrl,
      contentType,
      hint:
        'DOCUMENTS_API_BASE_URL must point to Filipo-Web where app/api/v1/clients/invoices/route.ts exists. ' +
        'Wrong port, wrong project, or outdated checkout causes Next to serve HTML 404 — not a clientId/balanceFilter issue.',
      validateWithCurl: [
        `curl -sS -D - "${base}/api/v1/clients/invoices?clientId=test&balanceFilter=all" \\`,
        `  -H "X-API-Token: <DOCUMENTS_API_TOKEN>" \\`,
        `  -H "Accept: application/json"`,
      ].join('\n'),
    },
  };
}

/**
 * GET /api/billing/invoices
 * Proxy to Filipo GET /api/v1/clients/invoices (receivable history).
 * - client: scoped to current user (identification or CLI{id}).
 * - admin, agent: all clients of tenant, optional ?clientId= filter.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== 'client' && role !== 'admin' && role !== 'agent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
    const token = process.env.DOCUMENTS_API_TOKEN?.trim();
    if (!baseUrl || !token) {
      return NextResponse.json({ error: 'Billing service not configured' }, { status: 503 });
    }

    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/clients/invoices`);

    if (role === 'client') {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, identification: true },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const clientId = user.identification?.trim() || `CLI${user.id}`;
      url.searchParams.set('clientId', clientId);
    } else {
      const filterClientId = request.nextUrl.searchParams.get('clientId')?.trim();
      if (filterClientId) {
        url.searchParams.set('clientId', filterClientId);
      }
    }

    const { searchParams } = new URL(request.url);
    const balanceFilter = searchParams.get('balanceFilter');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    if (balanceFilter === 'pending' || balanceFilter === 'paid' || balanceFilter === 'all') {
      url.searchParams.set('balanceFilter', balanceFilter);
    }
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);
    if (limit) url.searchParams.set('limit', limit);
    if (offset) url.searchParams.set('offset', offset);

    const requestUrl = url.toString();
    console.info('[billing/invoices] Upstream GET', requestUrl);

    const res = await fetchWithTimeout(
      requestUrl,
      {
        method: 'GET',
        headers: UPSTREAM_INVOICES_HEADERS(token),
      },
      DOCUMENTS_API_TIMEOUT_MS
    );

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      const contentType = res.headers.get('content-type');
      const preview = text.replace(/\s+/g, ' ').slice(0, 400);
      const html = isHtmlResponse(contentType, text);

      console.error('[billing/invoices] Upstream returned non-JSON:', {
        status: res.status,
        url: requestUrl,
        contentType,
        bodyPreview: preview || '(empty)',
        parseError: parseErr instanceof Error ? parseErr.message : parseErr,
        likelyNextHtml404: html && (res.status === 404 || res.status === 405),
      });

      if (html && (res.status === 404 || res.status === 405)) {
        const payload = upstreamRouteMissingMessage(requestUrl, res.status, contentType);
        return NextResponse.json(payload, { status: 502 });
      }

      return NextResponse.json(
        {
          error: 'Invalid response from billing service (not JSON)',
          details: {
            upstreamStatus: res.status,
            contentType,
            bodyPreview: preview || null,
            upstreamUrl: requestUrl,
          },
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const errBody = data as { error?: { message?: string } };
      const message = errBody?.error?.message || res.statusText;
      console.error('[billing/invoices] Upstream error:', {
        status: res.status,
        url: requestUrl,
        message,
        data: data && typeof data === 'object' ? data : String(data).slice(0, 500),
      });
      return NextResponse.json(
        {
          error: message,
          details: {
            upstreamStatus: res.status,
            upstreamUrl: requestUrl,
          },
          data,
        },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[billing/invoices] Fetch failed:', {
      reason: isAbort ? 'timeout' : 'network_or_other',
      message: msg,
      cause: err instanceof Error && 'cause' in err ? String((err as Error & { cause?: unknown }).cause) : undefined,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      {
        error: isAbort ? 'Request timed out' : `Failed to fetch invoices: ${msg}`,
        details: { reason: isAbort ? 'timeout' : 'fetch_error' },
      },
      { status: 502 }
    );
  }
}
