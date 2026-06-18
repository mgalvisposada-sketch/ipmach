import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, QuoteStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

const IN_PROGRESS_STATUSES: QuoteStatus[] = ['running', 'hot', 'warm', 'cold'];

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!prisma) {
            console.error('Prisma client is not available');
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';
        const userWhereClause = isAdmin ? {} : { agentId: userId };

        const quoteStatuses = await prisma.quotes.groupBy({
            by: ['status'],
            where: userWhereClause,
            _count: { status: true },
        });

        const countByStatus = Object.fromEntries(
            quoteStatuses.map((s) => [s.status, s._count.status])
        ) as Record<QuoteStatus, number>;

        const enProceso = IN_PROGRESS_STATUSES.reduce(
            (sum, status) => sum + (countByStatus[status] ?? 0),
            0
        );
        const cerrado = countByStatus.closed ?? 0;
        const cancelado = countByStatus.cancelled ?? 0;

        const data = [
            { status: 'En proceso', count: enProceso, color: 'bg-blue-500' },
            { status: 'Cerrado', count: cerrado, color: 'bg-green-500' },
            { status: 'Cancelado', count: cancelado, color: 'bg-gray-400' },
        ];

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching quote status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quote status' },
            { status: 500 }
        );
    }
}
