import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import {
  getExternalPendingByClientUserId,
  extractBilledMotorOrderIds,
} from '@/lib/external-billing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (!orderId || orderId <= 0) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            email: true,
            phoneNumber: true,
            role: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check permissions: clients can only see their own orders, admins and agents can see all
    if (session.user.role === 'client' && order.clientId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    let filipoBilled = false;
    try {
      const { billedOrders } = await getExternalPendingByClientUserId(order.clientId);
      const billed = extractBilledMotorOrderIds(billedOrders);
      filipoBilled = billed.has(order.id);
    } catch {
      filipoBilled = false;
    }

    return NextResponse.json({
      success: true,
      data: { ...order, filipoBilled },
    });

  } catch (error: any) {
    console.error('Order retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (!orderId || orderId <= 0) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Only admins and agents can update orders
    if (session.user.role !== 'admin' && session.user.role !== 'agent') {
      return NextResponse.json(
        { error: 'Only admins and agents can update orders' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, observations } = body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
    }
    if (observations !== undefined) {
      updateData.observations = observations;
    }

    const order = await prisma.orders.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: order,
    });

  } catch (error: any) {
    console.error('Order update error:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}












