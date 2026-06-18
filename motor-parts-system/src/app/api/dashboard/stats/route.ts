import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if prisma is available
        if (!prisma) {
            console.error('Prisma client is not available');
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }


        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';

        // Get date ranges for comparison
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Build base where clauses based on user role
        const baseSearchWhere = isAdmin ? {} : { userId: userId };
        const isClient = session.user.role === 'client';
        const baseQuoteWhere = isAdmin ? {} : isClient ? { clientId: userId } : { agentId: userId };
        const baseOrderWhere = isAdmin ? {} : isClient ? { clientId: userId } : {};

        // Fetch search statistics: last 30 days vs previous 30 days (days 31-60)
        const [totalSearches, previousPeriodSearches] = await Promise.all([
            prisma.searchLogs.count({
                where: {
                    ...baseSearchWhere,
                    timestamp: {
                        gte: thirtyDaysAgo,
                        lte: now
                    }
                }
            }),
            prisma.searchLogs.count({
                where: {
                    ...baseSearchWhere,
                    timestamp: {
                        gte: sixtyDaysAgo,
                        lt: thirtyDaysAgo
                    }
                }
            })
        ]);

        // Fetch quote statistics: last 30 days vs previous 30 days (days 31-60)
        const [totalQuotes, previousPeriodQuotes] = await Promise.all([
            prisma.quotes.count({
                where: {
                    ...baseQuoteWhere,
                    createdAt: {
                        gte: thirtyDaysAgo,
                        lte: now
                    }
                }
            }),
            prisma.quotes.count({
                where: {
                    ...baseQuoteWhere,
                    createdAt: {
                        gte: sixtyDaysAgo,
                        lt: thirtyDaysAgo
                    }
                }
            })
        ]);

        // Fetch active quotes: last 7 days vs previous 7 days (days 8-14)
        // Active quotes are those with status 'running', 'hot', 'warm', or 'cold'
        const [activeQuotes, previousActiveQuotes] = await Promise.all([
            prisma.quotes.count({
                where: {
                    ...baseQuoteWhere,
                    createdAt: {
                        gte: sevenDaysAgo,
                        lte: now
                    },
                    status: {
                        in: ['running', 'hot', 'warm', 'cold']
                    }
                }
            }),
            prisma.quotes.count({
                where: {
                    ...baseQuoteWhere,
                    createdAt: {
                        gte: fourteenDaysAgo,
                        lt: sevenDaysAgo
                    },
                    status: {
                        in: ['running', 'hot', 'warm', 'cold']
                    }
                }
            })
        ]);

        // Orders: last 30 days and previous 30 days (for count and for parts ordered)
        const [ordersCurrent, ordersPrevious] = await Promise.all([
            prisma.orders.findMany({
                where: {
                    ...baseOrderWhere,
                    createdAt: { gte: thirtyDaysAgo, lte: now }
                },
                select: { items: true }
            }),
            prisma.orders.findMany({
                where: {
                    ...baseOrderWhere,
                    createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
                },
                select: { items: true }
            })
        ]);

        const sumPartsOrdered = (orders: { items: unknown }[]): number => {
            let sum = 0;
            for (const order of orders) {
                const items = Array.isArray(order.items) ? (order.items as { quantity?: number }[]) : [];
                for (const item of items) {
                    sum += Number(item?.quantity) || 0;
                }
            }
            return sum;
        };

        const totalOrders = ordersCurrent.length;
        const previousPeriodOrders = ordersPrevious.length;
        const totalPartsOrdered = sumPartsOrdered(ordersCurrent);
        const previousPartsOrdered = sumPartsOrdered(ordersPrevious);

        // Conversion rate: units ordered per 100 searches (consultas vs unidades pedidas)
        const conversionRate = totalSearches > 0 ? (totalPartsOrdered / totalSearches) * 100 : 0;
        const previousConversionRate = previousPeriodSearches > 0
            ? (previousPartsOrdered / previousPeriodSearches) * 100
            : 0;

        // Calculate percentage changes
        const searchChange = previousPeriodSearches > 0
            ? ((totalSearches - previousPeriodSearches) / previousPeriodSearches) * 100
            : (totalSearches > 0 ? 100 : 0); // If previous period was 0 but current has data, show 100% increase

        const quoteChange = previousPeriodQuotes > 0
            ? ((totalQuotes - previousPeriodQuotes) / previousPeriodQuotes) * 100
            : (totalQuotes > 0 ? 100 : 0); // If previous period was 0 but current has data, show 100% increase

        const activeQuoteChange = previousActiveQuotes > 0
            ? ((activeQuotes - previousActiveQuotes) / previousActiveQuotes) * 100
            : (activeQuotes > 0 ? 100 : 0); // If previous period was 0 but current has data, show 100% increase

        const conversionChange = previousConversionRate > 0
            ? conversionRate - previousConversionRate
            : (conversionRate > 0 ? conversionRate : 0); // If previous period was 0 but current has data, show current rate as change

        const orderChange = previousPeriodOrders > 0
            ? ((totalOrders - previousPeriodOrders) / previousPeriodOrders) * 100
            : (totalOrders > 0 ? 100 : 0);

        const stats = {
            totalSearches: {
                value: totalSearches,
                change: searchChange,
                changeType: searchChange >= 0 ? 'positive' : 'negative'
            },
            totalQuotes: {
                value: totalQuotes,
                change: quoteChange,
                changeType: quoteChange >= 0 ? 'positive' : 'negative'
            },
            activeQuotes: {
                value: activeQuotes,
                change: activeQuoteChange,
                changeType: activeQuoteChange >= 0 ? 'positive' : 'negative'
            },
            conversionRate: {
                value: conversionRate,
                change: conversionChange,
                changeType: conversionChange >= 0 ? 'positive' : 'negative'
            },
            totalOrders: {
                value: totalOrders,
                change: orderChange,
                changeType: orderChange >= 0 ? 'positive' : 'negative'
            }
        };

        return NextResponse.json({ success: true, data: stats });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard statistics' },
            { status: 500 }
        );
    }
}
