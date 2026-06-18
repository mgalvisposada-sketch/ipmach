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

/**
 * GET /api/billing/pending
 * Proxy to Documents API GET /api/v1/clients/pending.
 * For client role: uses current user only (identification or CLI{id}).
 * Query: detail=summary|documents, startDate?, endDate?, limit?, offset?
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'client') {
      return NextResponse.json(
        { error: 'Only client role can access billing pending' },
        { status: 403 }
      );
    }

    const baseUrl = process.env.DOCUMENTS_API_BASE_URL?.trim();
    const token = process.env.DOCUMENTS_API_TOKEN?.trim();
    if (!baseUrl || !token) {
      return NextResponse.json(
        { error: 'Billing service not configured' },
        { status: 503 }
      );
    }

    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, identification: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clientId = user.identification?.trim() || `CLI${user.id}`;

    const { searchParams } = new URL(request.url);
    const detail = searchParams.get('detail') || 'summary';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/clients/pending`);
    url.searchParams.set('clientId', clientId);
    url.searchParams.set('detail', detail === 'documents' ? 'documents' : 'summary');
    if (startDate) url.searchParams.set('startDate', startDate);
    if (endDate) url.searchParams.set('endDate', endDate);
    if (limit) url.searchParams.set('limit', limit);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: { 'X-API-Token': token },
      },
      DOCUMENTS_API_TIMEOUT_MS
    );

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from billing service' },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string })?.error || res.statusText, data },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.error('[billing/pending] Error:', isAbort ? 'timeout' : err);
    return NextResponse.json(
      { error: isAbort ? 'Request timed out' : 'Failed to fetch pending billing' },
      { status: 502 }
    );
  }
}
