import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userType = searchParams.get('userType');

    const where: any = {};

    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (userType) {
      where.userType = userType;
    }

    // Get search analytics
    const searches = await prisma.searchLogs.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
    });

    // Get aggregated stats
    const totalSearches = await prisma.searchLogs.count({ where });
    const searchesWithStock = await prisma.searchLogs.count({
      where: { ...where, hasStock: true },
    });
    const searchesWithoutStock = await prisma.searchLogs.count({
      where: { ...where, hasStock: false },
    });

    // Get popular search terms
    const popularSearches = await prisma.$queryRaw`
      SELECT "searchTerm", COUNT(*) as count
      FROM "SearchLogs"
      WHERE ${where.timestamp ? `"timestamp" >= ${new Date(startDate!)} AND "timestamp" <= ${new Date(endDate!)}` : '1=1'}
      GROUP BY "searchTerm"
      ORDER BY count DESC
      LIMIT 10
    `;

    return NextResponse.json({
      success: true,
      data: {
        searches,
        stats: {
          totalSearches,
          searchesWithStock,
          searchesWithoutStock,
          stockAvailabilityRate: totalSearches > 0 ? (searchesWithStock / totalSearches) * 100 : 0,
        },
        popularSearches,
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
