import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Get client information from local database by identification (NIT, ID, etc.)
 * Searches for a client in Users with role client.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const identification = searchParams.get('identification') || searchParams.get('id') || '';

        if (!identification || !identification.trim()) {
            return NextResponse.json(
                { error: 'identification parameter is required' },
                { status: 400 }
            );
        }

        const users = await prisma.users.findMany({
            where: {
                role: 'client',
                isActive: true,
                OR: [
                    { identification: { equals: identification.trim(), mode: 'insensitive' } },
                    { identification: { contains: identification.trim(), mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                username: true,
                email: true,
                identification: true,
                clientType: true,
            },
        });

        const clients = users.map((u) => ({
            id: u.id,
            name: u.username || u.email || '',
            code: u.identification || u.username || undefined,
            identification: u.identification || undefined,
            discountRate: undefined,
            clientType: u.clientType ?? undefined,
        }));

        if (clients.length === 0) {
            return NextResponse.json(
                { error: 'Client not found with the provided identification' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            client: clients[0],
            clients: clients.length > 1 ? clients : undefined,
        });
    } catch (error: any) {
        console.error('Error fetching client by identification:', error);
        return NextResponse.json(
            { error: 'Failed to fetch client information' },
            { status: 500 }
        );
    }
}
