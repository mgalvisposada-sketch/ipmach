import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        const days = Math.min(Math.max(parseInt(searchParams.get('days') || '90', 10), 1), 365);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
        const since = subDays(new Date(), days);

        const clients = await prisma.users.findMany({
            where: { role: 'client' },
            select: {
                id: true,
                username: true,
                email: true,
                clientType: true,
                searchAllowed: true,
                searchQuotaLimit: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const clientIds = clients.map((c) => c.id);

        const [searchCounts, orderCounts, lastSearch, lastOrder] = await Promise.all([
            prisma.searchLogs.groupBy({
                by: ['userId'],
                where: {
                    userId: { in: clientIds },
                    timestamp: { gte: since },
                },
                _count: { id: true },
            }),
            prisma.orders.groupBy({
                by: ['clientId'],
                where: {
                    clientId: { in: clientIds },
                    createdAt: { gte: since },
                },
                _count: { id: true },
            }),
            prisma.searchLogs.findMany({
                where: { userId: { in: clientIds } },
                select: { userId: true, timestamp: true },
                orderBy: { timestamp: 'desc' },
                distinct: ['userId'],
            }),
            prisma.orders.findMany({
                where: { clientId: { in: clientIds } },
                select: { clientId: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                distinct: ['clientId'],
            }),
        ]);

        const searchByUser = new Map(searchCounts.map((s) => [s.userId!, s._count.id]));
        const orderByUser = new Map(orderCounts.map((o) => [o.clientId, o._count.id]));
        const lastSearchByUser = new Map(lastSearch.map((s) => [s.userId!, s.timestamp]));
        const lastOrderByUser = new Map(lastOrder.map((o) => [o.clientId, o.createdAt]));

        const list = clients.map((c) => {
            const totalSearches = searchByUser.get(c.id) ?? 0;
            const totalOrders = orderByUser.get(c.id) ?? 0;
            const conversionRate =
                totalSearches > 0 ? Math.round((totalOrders / totalSearches) * 1000) / 10 : 0;
            return {
                id: c.id,
                username: c.username,
                email: c.email,
                clientType: c.clientType ?? null,
                searchAllowed: c.searchAllowed,
                searchQuotaLimit: c.searchQuotaLimit,
                totalSearches,
                totalOrders,
                conversionRate,
                lastSearch: lastSearchByUser.get(c.id) ?? null,
                lastOrder: lastOrderByUser.get(c.id) ?? null,
            };
        });

        list.sort((a, b) => {
            if (a.totalOrders === 0 && b.totalOrders > 0) return -1;
            if (a.totalOrders > 0 && b.totalOrders === 0) return 1;
            if (a.totalSearches !== b.totalSearches) return b.totalSearches - a.totalSearches;
            return a.conversionRate - b.conversionRate;
        });

        const data = list.slice(0, limit);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching client conversion:', error);
        return NextResponse.json(
            { error: 'Failed to fetch client conversion' },
            { status: 500 }
        );
    }
}
