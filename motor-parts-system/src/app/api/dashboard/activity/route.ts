import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, QuoteStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
    running: 'En proceso',
    hot: 'En proceso',
    warm: 'En proceso',
    cold: 'En proceso',
    closed: 'Cerrado',
    cancelled: 'Cancelado',
};

const FETCH_PER_TYPE = 15;

type ActivityType = 'search' | 'quote' | 'order';

interface ActivityItem {
    id: string;
    type: ActivityType;
    message: string;
    timestamp: Date;
    user: string;
    status: 'success' | 'warning' | 'error';
    action?: { label: string; href: string };
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!prisma) {
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';
        const isClient = session.user.role === 'client';
        const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '15'), 30);

        const searchWhere = isAdmin ? {} : { userId };
        const quoteWhere = isAdmin ? {} : { agentId: userId };

        const [recentSearches, recentQuotes, recentOrders] = await Promise.all([
            prisma.searchLogs.findMany({
                where: searchWhere,
                orderBy: { timestamp: 'desc' },
                take: FETCH_PER_TYPE,
                select: {
                    id: true,
                    searchTerm: true,
                    resultCount: true,
                    timestamp: true,
                    userId: true,
                },
            }),
            !isClient
                ? prisma.quotes.findMany({
                      where: quoteWhere,
                      orderBy: { createdAt: 'desc' },
                      take: FETCH_PER_TYPE,
                      select: {
                          id: true,
                          clientName: true,
                          status: true,
                          createdAt: true,
                          totalAmount: true,
                          agentId: true,
                      },
                  })
                : Promise.resolve([]),
            isAdmin
                ? prisma.orders.findMany({
                      orderBy: { createdAt: 'desc' },
                      take: FETCH_PER_TYPE,
                      select: {
                          id: true,
                          clientName: true,
                          totalAmount: true,
                          createdAt: true,
                          status: true,
                          clientId: true,
                          client: { select: { username: true } },
                      },
                  })
                : Promise.resolve([]),
        ]);

        const userIds = new Set<number>();
        recentSearches.forEach((s) => s.userId != null && userIds.add(s.userId));
        recentQuotes.forEach((q) => q.agentId != null && q.agentId > 0 && userIds.add(q.agentId));
        let userMap = new Map<number, string>();
        if (userIds.size > 0) {
            const users = await prisma.users.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, username: true },
            });
            userMap = new Map(users.map((u) => [u.id, u.username]));
        }

        const activities: ActivityItem[] = [];

        for (const s of recentSearches) {
            activities.push({
                id: `search-${s.id}`,
                type: 'search',
                message: `Búsqueda: "${s.searchTerm}" (${s.resultCount} resultado${s.resultCount !== 1 ? 's' : ''})`,
                timestamp: s.timestamp,
                user: s.userId != null ? (userMap.get(s.userId) ?? `Usuario #${s.userId}`) : 'Sesión anónima',
                status: s.resultCount > 0 ? 'success' : 'warning',
                action: {
                    label: 'Buscar de nuevo',
                    href: `/client-search?q=${encodeURIComponent(s.searchTerm)}`,
                },
            });
        }

        for (const q of recentQuotes) {
            const statusLabel = QUOTE_STATUS_LABEL[q.status] ?? q.status;
            const clientLabel = q.clientName?.trim() || 'Sin nombre';
            activities.push({
                id: `quote-${q.id}`,
                type: 'quote',
                message: `Cotización #${q.id} para ${clientLabel} (${statusLabel})`,
                timestamp: q.createdAt,
                user: q.agentId != null && q.agentId > 0 ? (userMap.get(q.agentId) ?? `Agente #${q.agentId}`) : 'Sistema',
                status: q.status === 'closed' ? 'success' : q.status === 'cancelled' ? 'error' : 'warning',
                action: { label: 'Ver cotización', href: `/quotes?highlight=${q.id}` },
            });
        }

        for (const o of recentOrders) {
            const clientLabel = o.clientName?.trim() || o.client?.username || `Cliente #${o.clientId}`;
            const total = Number(o.totalAmount);
            const totalStr = total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            activities.push({
                id: `order-${o.id}`,
                type: 'order',
                message: `Pedido #${o.id} — ${clientLabel} — ${totalStr}`,
                timestamp: o.createdAt,
                user: o.client?.username ?? clientLabel,
                status: o.status === 'cancelled' ? 'error' : o.status === 'delivered' ? 'success' : 'warning',
                action: { label: 'Ver pedido', href: '/orders' },
            });
        }

        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const data = activities.slice(0, limit);

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        return NextResponse.json(
            { error: 'Failed to fetch recent activity' },
            { status: 500 }
        );
    }
}
