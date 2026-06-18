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
    const status = searchParams.get('status');

    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    // Admin can see all quotes, agents can only see their own
    if (session.user.role !== 'admin') {
      where.agentId = parseInt(session.user.id);
    }

    // Get quote analytics
    const quotes = await prisma.quotes.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Get aggregated stats
    const totalQuotes = await prisma.quotes.count({ where });
    const runningQuotes = await prisma.quotes.count({
      where: { ...where, status: 'running' },
    });
    const hotQuotes = await prisma.quotes.count({
      where: { ...where, status: 'hot' },
    });
    const warmQuotes = await prisma.quotes.count({
      where: { ...where, status: 'warm' },
    });
    const coldQuotes = await prisma.quotes.count({
      where: { ...where, status: 'cold' },
    });
    const closedQuotes = await prisma.quotes.count({
      where: { ...where, status: 'closed' },
    });

    // Calculate total revenue
    const revenueData = await prisma.quotes.aggregate({
      where: { ...where, status: 'closed' },
      _sum: {
        totalAmount: true,
      },
    });

    const totalRevenue = revenueData._sum.totalAmount || 0;

    // Get quote performance by status
    const statusBreakdown = [
      { status: 'Running', count: runningQuotes, color: 'bg-blue-500' },
      { status: 'Hot', count: hotQuotes, color: 'bg-red-500' },
      { status: 'Warm', count: warmQuotes, color: 'bg-yellow-500' },
      { status: 'Cold', count: coldQuotes, color: 'bg-gray-500' },
      { status: 'Closed', count: closedQuotes, color: 'bg-green-500' },
    ];

    return NextResponse.json({
      success: true,
      data: {
        quotes,
        stats: {
          totalQuotes,
          runningQuotes,
          hotQuotes,
          warmQuotes,
          coldQuotes,
          closedQuotes,
          totalRevenue,
          conversionRate: totalQuotes > 0 ? (closedQuotes / totalQuotes) * 100 : 0,
        },
        statusBreakdown,
      },
    });
  } catch (error) {
    console.error('Quote analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote analytics' },
      { status: 500 }
    );
  }
}
