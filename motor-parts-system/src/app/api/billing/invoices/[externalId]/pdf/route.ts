import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DOCUMENTS_API_TIMEOUT_MS = 60_000;

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

/**
 * GET /api/billing/invoices/[externalId]/pdf?type=sale|remision
 * Proxies to Filipo GET /api/v1/documents/[externalId]/pdf with X-API-Token.
 * Clients always send clientId to Filipo (enforced server-side).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ externalId: string }> }
) {
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

    const { externalId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const purpose = searchParams.get('purpose') === 'print' ? 'print' : 'download';

    if (!type || (type !== 'sale' && type !== 'remision')) {
      return NextResponse.json(
        { error: 'Query parameter type=sale or type=remision is required' },
        { status: 400 }
      );
    }

    const url = new URL(
      `${baseUrl.replace(/\/$/, '')}/api/v1/documents/${encodeURIComponent(externalId)}/pdf`
    );
    url.searchParams.set('type', type);
    url.searchParams.set('purpose', purpose);

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
      const optionalClientId = searchParams.get('clientId')?.trim();
      if (optionalClientId) {
        url.searchParams.set('clientId', optionalClientId);
      }
    }

    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: { 'X-API-Token': token },
      },
      DOCUMENTS_API_TIMEOUT_MS
    );

    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text.slice(0, 200) };
      }
      const status = res.status === 403 || res.status === 404 ? res.status : res.status >= 500 ? 502 : res.status;
      return NextResponse.json(
        { error: (parsed as { error?: { message?: string } })?.error?.message || res.statusText },
        { status }
      );
    }

    const buf = await res.arrayBuffer();
    const out = new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': res.headers.get('Content-Disposition') || `attachment; filename="${type}-${externalId}.pdf"`,
      },
    });
    return out;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[billing/invoices/pdf] Error:', isAbort ? 'timeout' : err);
    return NextResponse.json(
      { error: isAbort ? 'Request timed out' : 'Failed to download PDF' },
      { status: 502 }
    );
  }
}
