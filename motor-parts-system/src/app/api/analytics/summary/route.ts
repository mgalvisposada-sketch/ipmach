import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { subQuarters } from 'date-fns';
import {
  calculateConversionForMultipleReferences,
  calculatePeriodStats,
} from '@/lib/analytics/conversion-calculator';
import { evaluateStockRecommendation } from '@/lib/analytics/stock-recommender';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

/**
 * GET /api/analytics/summary
 * Retorna métricas resumidas para mostrar en el dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only admins can access
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      );
    }

    // Default to last quarter
    const endDate = new Date();
    const startDate = subQuarters(endDate, 1);

    // Fetch searches in the last quarter
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

    // Fetch orders in the last quarter
    const ordersRaw = await prisma.orders.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['cancelled'],
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

    const orders = ordersRaw.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
    }));

    // Calculate metrics for all references
    const metrics = calculateConversionForMultipleReferences(searches, orders);

    // Filter references with at least 5 searches for recommendations
    const significantReferences = metrics.filter((m) => m.totalSearches >= 5);

    // Count recommended references (score >= 70)
    let recommendedCount = 0;
    significantReferences.forEach((metric) => {
      const recommendation = evaluateStockRecommendation(metric, 'stable');
      if (recommendation.recommended) {
        recommendedCount++;
      }
    });

    // Period stats: total searches and total references (for labels)
    const periodStats = calculatePeriodStats(metrics);
    const totalSearches = periodStats.totalSearches;
    const totalReferences = metrics.length;

    // Reference-level conversion: of the references that were searched, how many appeared in at least one order?
    const referencesConverted = metrics.filter((m) => m.totalOrders > 0).length;
    const referenceConversionRate =
      totalReferences > 0
        ? Math.round((referencesConverted / totalReferences) * 1000) / 10
        : 0;

    // Distinct order count in the period (for context; not used as numerator for conversion)
    const distinctOrderCount = ordersRaw.length;

    return NextResponse.json({
      success: true,
      data: {
        recommendedReferences: recommendedCount,
        avgConversionRate: referenceConversionRate,
        totalReferences,
        totalSearches,
        totalOrders: distinctOrderCount,
        referencesConverted,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          label: 'Último trimestre',
        },
      },
    });
  } catch (error) {
    console.error('Error in analytics summary:', error);
    return NextResponse.json(
      { error: 'Error al obtener resumen de analytics' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
