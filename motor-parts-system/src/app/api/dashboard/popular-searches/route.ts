import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

const MAX_LOGS_READ = 5000;

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!prisma) {
            console.error('Prisma client is not available');
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';
        const searchParams = request.nextUrl.searchParams;
        const days = parseInt(searchParams.get('days') || '7');
        const minCount = parseInt(searchParams.get('minCount') || '2');
        const limit = parseInt(searchParams.get('limit') || '8');

        const userWhereClause = isAdmin ? {} : { userId };
        const since = subDays(new Date(), days);

        const logs = await prisma.searchLogs.findMany({
            where: {
                ...userWhereClause,
                timestamp: { gte: since },
            },
            select: {
                searchTerm: true,
                resultCount: true,
            },
            orderBy: { timestamp: 'desc' },
            take: MAX_LOGS_READ,
        });

        const byNormalized = new Map<
            string,
            { count: number; totalResults: number; hasStock: boolean }
        >();

        for (const log of logs) {
            const key = normalizeReference(log.searchTerm);
            if (!key) continue;

            const existing = byNormalized.get(key);
            const count = (existing?.count ?? 0) + 1;
            const totalResults = (existing?.totalResults ?? 0) + (log.resultCount ?? 0);
            const hasStock = existing?.hasStock ?? (log.resultCount > 0);

            byNormalized.set(key, { count, totalResults, hasStock });
        }

        const formattedSearches = Array.from(byNormalized.entries())
            .filter(([, data]) => data.count >= minCount)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit)
            .map(([term, data]) => ({
                term,
                count: data.count,
                avgResults: Math.round(data.totalResults / data.count),
                hasStock: data.hasStock,
            }));

        return NextResponse.json({ success: true, data: formattedSearches });
    } catch (error) {
        console.error('Error fetching popular searches:', error);
        return NextResponse.json(
            { error: 'Failed to fetch popular searches' },
            { status: 500 }
        );
    }
}
