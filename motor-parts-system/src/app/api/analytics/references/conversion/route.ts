import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import {
  calculateConversionForMultipleReferences,
  sortMetrics,
  filterMetricsByThreshold,
  calculatePeriodStats,
  normalizeReference,
} from '@/lib/analytics/conversion-calculator';
import { detectTrend } from '@/lib/analytics/trend-detector';
import { evaluateStockRecommendation } from '@/lib/analytics/stock-recommender';
import { subQuarters, subMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only admins can access this endpoint
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = (searchParams.get('sortBy') || 'searches') as
      | 'searches'
      | 'conversion'
      | 'revenue'
      | 'orders';
    const minSearches = parseInt(searchParams.get('minSearches') || '1');

    // Default to last quarter if no dates provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : subQuarters(endDate, 1);

    console.log('Reference Analytics API:', {
      startDate,
      endDate,
      limit,
      sortBy,
      minSearches,
    });

    // Fetch searches in the period
    const searches = await prisma.searchLogs.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        searchTerm: true,
        timestamp: true,
        userId: true,
        hasStock: true,
        resultCount: true,
      },
    });

    // Fetch orders in the period
    const ordersRaw = await prisma.orders.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['cancelled'], // Exclude cancelled orders
        },
      },
      select: {
        id: true,
        clientId: true,
        items: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    // Convert Decimal to number for compatibility
    const orders = ordersRaw.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
    }));

    // Calculate conversion metrics for all references
    let metrics = calculateConversionForMultipleReferences(searches, orders);

    // Filter by minimum searches threshold
    metrics = filterMetricsByThreshold(metrics, minSearches, 0);

    // Add trend analysis for each reference
    const metricsWithTrend = metrics.map((metric) => {
      // Get searches for this reference over time (use same normalization as conversion calculator)
      const refNormalized = normalizeReference(metric.reference);
      const refSearches = searches.filter(
        (s) => normalizeReference(s.searchTerm) === refNormalized
      );

      // Group by date for trend analysis
      const searchesByDate = new Map<string, number>();
      refSearches.forEach((search) => {
        const dateKey = search.timestamp.toISOString().split('T')[0];
        searchesByDate.set(dateKey, (searchesByDate.get(dateKey) || 0) + 1);
      });

      const dataPoints = Array.from(searchesByDate.entries()).map(([date, count]) => ({
        date: new Date(date),
        value: count,
      }));

      const trend = detectTrend(dataPoints);

      // Get stock recommendation
      const recommendation = evaluateStockRecommendation(
        metric,
        trend.direction === 'increasing'
          ? 'up'
          : trend.direction === 'decreasing'
          ? 'down'
          : 'stable'
      );

      return {
        ...metric,
        trendDirection: trend.direction,
        trendSlope: trend.slope,
        trendConfidence: trend.confidence,
        stockRecommended: recommendation.recommended,
        stockScore: recommendation.score,
        stockPriority: recommendation.priority,
      };
    });

    // Sort by specified criteria
    const sorted = sortMetrics(metricsWithTrend, sortBy, 'desc');

    // Apply limit
    const limited = sorted.slice(0, limit);

    // Calculate period statistics
    const periodStats = calculatePeriodStats(metrics);

    return NextResponse.json({
      success: true,
      data: {
        references: limited,
        periodInfo: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          ...periodStats,
        },
        meta: {
          total: metrics.length,
          returned: limited.length,
          sortBy,
          minSearches,
        },
      },
    });
  } catch (error) {
    console.error('Error in reference analytics API:', error);
    return NextResponse.json(
      { error: 'Error al obtener análisis de referencias' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
