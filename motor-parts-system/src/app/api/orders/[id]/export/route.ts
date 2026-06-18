import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { generateOrderPdfBuffer } from '@/lib/order-pdf';

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
        const { searchParams } = new URL(request.url);
        const printReference = searchParams.get('printReference') === '1';
        if (!orderId || orderId <= 0) {
            return NextResponse.json(
                { error: 'Invalid order ID' },
                { status: 400 }
            );
        }

        // Fetch the order with all necessary fields
        const order = await prisma.orders.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                clientId: true,
                clientName: true,
                items: true,
                status: true,
                createdAt: true,
                totalAmount: true,
                discountPercent: true,
                discountAmount: true,
                ivaPercent: true,
                ivaAmount: true,
                observations: true,
                orderName: true,
                dispatchType: true,
                pickupEntity: true,
                pickupName: true,
                carrierName: true,
                carrierAddress: true,
                carrierPhone: true,
                carrierContactName: true,
                paymentMethod: true,
            },
        });

        if (!order) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        // Fetch client information separately (include address for Bill to / Ship to)
        const client = await prisma.users.findUnique({
            where: { id: order.clientId },
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                role: true,
                address: true,
                city: true,
                stateOrDepartment: true,
                country: true,
            },
        });

        // Check permissions (clients can only see their own orders, admins and agents can see all)
        if (session.user.role === 'client' && order.clientId !== parseInt(session.user.id)) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        const buffer = await generateOrderPdfBuffer(
            order as Parameters<typeof generateOrderPdfBuffer>[0],
            client,
            { printReference }
        );

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="orden-${order.id}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('PDF export error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}











