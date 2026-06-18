import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getExternalPendingByClientUserId } from '@/lib/external-billing';
import { getFilipoClientCreditForUserId } from '@/lib/filipo-client-credit';
import { getPortfolioBlockStateForClientUserId } from '@/lib/portfolio-receivables';
import { PORTFOLIO_OVERDUE_GRACE_DAYS } from '@/lib/portfolio-credit-terms';

export const dynamic = 'force-dynamic';

/**
 * Credit and portfolio summary for the logged-in client only.
 * Used by the Crédito page: limit, external debt, open orders consuming quota, and line-level pending orders.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = parseInt(session.user.id, 10);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const filipo = await getFilipoClientCreditForUserId(userId);
    const hasCredit = Boolean(filipo?.creditEnabled);
    const creditLimitNum = filipo?.creditLimit ?? 0;

    const { pendingAmount: externalDebt } = await getExternalPendingByClientUserId(userId);

    const pendingOrders = await prisma.orders.findMany({
      where: {
        clientId: userId,
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        orderName: true,
        paymentStatus: true,
      },
    });

    const pendingSum = await prisma.orders.aggregate({
      where: {
        clientId: userId,
        status: { in: ['pending', 'processing'] },
      },
      _sum: { totalAmount: true },
    });
    const pendingOrdersSum =
      pendingSum._sum.totalAmount != null ? Number(pendingSum._sum.totalAmount) : 0;

    const availableCredit = hasCredit
      ? Math.max(0, creditLimitNum - externalDebt - pendingOrdersSum)
      : 0;

    const creditDaysLimit = filipo != null ? filipo.creditDaysLimit : null;

    let portfolioBlocked = false;
    let portfolioBlockMessage: string | null = null;
    let portfolioOverdueCount = 0;
    if (hasCredit) {
      const p = await getPortfolioBlockStateForClientUserId(userId, {
        filipoCreditDaysLimit: filipo?.creditDaysLimit ?? null,
      });
      portfolioBlocked = p.blocked;
      portfolioBlockMessage = p.message ?? null;
      portfolioOverdueCount = p.overdueCount;
    }

    return NextResponse.json({
      success: true,
      data: {
        hasCredit,
        creditLimit: hasCredit ? creditLimitNum : null,
        creditDaysLimit,
        creditPaymentTermDays: creditDaysLimit,
        portfolioBlocked,
        portfolioBlockMessage,
        portfolioOverdueCount,
        portfolioOverdueGraceDays: PORTFOLIO_OVERDUE_GRACE_DAYS,
        externalDebt,
        pendingOrdersSum,
        availableCredit: hasCredit ? availableCredit : 0,
        pendingOrders: pendingOrders.map((o) => ({
          id: o.id,
          totalAmount: Number(o.totalAmount),
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          orderName: o.orderName,
          paymentStatus: o.paymentStatus,
        })),
      },
    });
  } catch (e) {
    console.error('[GET /api/credit/summary]', e);
    return NextResponse.json({ error: 'Failed to load credit summary' }, { status: 500 });
  }
}
