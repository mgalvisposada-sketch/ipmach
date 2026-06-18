import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_QUERY_LEN = 80;
const FETCH_CAP = 150;
const RESULT_LIMIT = 8;

type CommandBarOrder = { id: number; label: string; href: string };
type CommandBarQuote = { id: number; label: string; href: string };

function normalizeItems(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>;
}

function orderMatchesQuery(
  row: {
    id: number;
    clientName: string | null;
    orderName: string | null;
    observations: string | null;
    items: unknown;
  },
  searchLower: string
): boolean {
  if (row.id.toString().includes(searchLower)) return true;
  if (row.clientName?.toLowerCase().includes(searchLower)) return true;
  if (row.orderName?.toLowerCase().includes(searchLower)) return true;
  if (row.observations?.toLowerCase().includes(searchLower)) return true;
  return normalizeItems(row.items).some((item) => {
    const ref = typeof item.reference === 'string' ? item.reference : '';
    const desc = typeof item.description === 'string' ? item.description : '';
    return (
      ref.toLowerCase().includes(searchLower) || desc.toLowerCase().includes(searchLower)
    );
  });
}

function quoteMatchesQuery(
  row: {
    id: number;
    clientName: string | null;
    observations: string | null;
    items: unknown;
  },
  searchLower: string
): boolean {
  if (row.id.toString().includes(searchLower)) return true;
  if (row.clientName?.toLowerCase().includes(searchLower)) return true;
  if (row.observations?.toLowerCase().includes(searchLower)) return true;
  return normalizeItems(row.items).some((item) => {
    const ref = typeof item.reference === 'string' ? item.reference : '';
    const desc = typeof item.description === 'string' ? item.description : '';
    const brand = typeof item.brand === 'string' ? item.brand : '';
    return (
      ref.toLowerCase().includes(searchLower) ||
      desc.toLowerCase().includes(searchLower) ||
      brand.toLowerCase().includes(searchLower)
    );
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clientId = parseInt(session.user.id, 10);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get('q') || '').trim();
    if (!raw) {
      return NextResponse.json({ orders: [] as CommandBarOrder[], quotes: [] as CommandBarQuote[] });
    }

    const q = raw.slice(0, MAX_QUERY_LEN);
    const searchLower = q.toLowerCase();

    const [orderRows, quoteRows] = await Promise.all([
      prisma.orders.findMany({
        where: { clientId },
        orderBy: { updatedAt: 'desc' },
        take: FETCH_CAP,
        select: {
          id: true,
          clientName: true,
          orderName: true,
          observations: true,
          items: true,
        },
      }),
      prisma.quotes.findMany({
        where: { clientId },
        orderBy: { updatedAt: 'desc' },
        take: FETCH_CAP,
        select: {
          id: true,
          clientName: true,
          observations: true,
          items: true,
        },
      }),
    ]);

    const qEncoded = encodeURIComponent(q);

    const orders: CommandBarOrder[] = [];
    for (const row of orderRows) {
      if (!orderMatchesQuery(row, searchLower)) continue;
      const labelParts = [`Orden #${row.id}`];
      if (row.orderName?.trim()) labelParts.push(row.orderName.trim());
      orders.push({
        id: row.id,
        label: labelParts.join(' · '),
        href: `/orders?q=${qEncoded}`,
      });
      if (orders.length >= RESULT_LIMIT) break;
    }

    const quotes: CommandBarQuote[] = [];
    for (const row of quoteRows) {
      if (!quoteMatchesQuery(row, searchLower)) continue;
      const name = row.clientName?.trim();
      quotes.push({
        id: row.id,
        label: name ? `Cotización #${row.id} · ${name}` : `Cotización #${row.id}`,
        href: `/quotes?q=${qEncoded}`,
      });
      if (quotes.length >= RESULT_LIMIT) break;
    }

    return NextResponse.json({ orders, quotes });
  } catch (error) {
    console.error('[command-bar]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
