import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { analyzeSeasonality } from '@/lib/analytics/seasonality-analyzer';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';
import { subYears } from 'date-fns';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
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

    const params = await context.params;
    const reference = decodeURIComponent(params.reference);
    const searchParams = request.nextUrl.searchParams;
    const periods = parseInt(searchParams.get('periods') || '12'); // months

    console.log('Seasonality API for reference:', reference, 'periods:', periods);

    // Get historical data (default: last 2 years)
    const endDate = new Date();
    const startDate = subYears(endDate, 2);

    // Fetch searches for this reference
    const searches = await prisma.searchLogs.findMany({
      where: {
        searchTerm: {
          mode: 'insensitive',
          equals: reference,
        },
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        searchTerm: true,
        timestamp: true,
        userId: true,
      },
    });

    // Fetch orders that contain this reference
    const allOrders = await prisma.orders.findMany({
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
        items: true,
        createdAt: true,
        totalAmount: true,
      },
    });

    // Filter orders by normalized reference (9X1439 = 9x1439 = 9X 1439)
    const normalizedRef = normalizeReference(reference);
    const relevantOrders = allOrders.filter((order) => {
      const items = Array.isArray(order.items)
        ? order.items
        : JSON.parse((order.items as any) || '[]');

      return items.some(
        (item: any) => normalizeReference(item.reference) === normalizedRef
      );
    });

    // Perform seasonality analysis
    const analysis = analyzeSeasonality(
      reference,
      searches.map((s) => ({
        searchTerm: s.searchTerm,
        timestamp: new Date(s.timestamp),
        userId: s.userId,
      })),
      relevantOrders.map((o) => ({
        id: o.id,
        items: o.items,
        createdAt: new Date(o.createdAt),
        totalAmount: Number(o.totalAmount),
      }))
    );

    // Add additional context
    const totalSearches = searches.length;
    const totalOrders = relevantOrders.length;
    const conversionRate = totalSearches > 0 ? (totalOrders / totalSearches) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        reference,
        seasonality: {
          quarterly: analysis.quarterly,
          monthly: analysis.monthly,
          weekly: analysis.weekly,
        },
        trend: analysis.trend,
        seasonalPattern: analysis.seasonalPattern,
        prediction: analysis.prediction,
        context: {
          totalSearches,
          totalOrders,
          conversionRate: Math.round(conversionRate * 100) / 100,
          periodStart: startDate.toISOString(),
          periodEnd: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Error in seasonality API:', error);
    return NextResponse.json(
      { error: 'Error al analizar estacionalidad' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
