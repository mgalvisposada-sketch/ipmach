import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pushOrderToFilipo } from '@/lib/filipo-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado. Solo administradores pueden recrear órdenes.' }, { status: 401 });
    }

    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const client = await prisma.users.findUnique({
      where: { id: order.clientId },
      select: {
        id: true,
        username: true,
        identification: true,
        phoneNumber: true,
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente de la orden no encontrado' }, { status: 404 });
    }

    const result = await pushOrderToFilipo(order as any, client as any);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Orden recreada exitosamente en Filipo' });
  } catch (error: any) {
    console.error('Error recreating order in Filipo:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al recrear la orden' },
      { status: 500 }
    );
  }
}
