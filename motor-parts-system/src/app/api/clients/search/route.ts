import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const searchTerm = (searchParams.get('searchTerm') || searchParams.get('q') || '').trim();
        const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

        const users = searchTerm
            ? await prisma.users.findMany({
                where: {
                    role: 'client',
                    isActive: true,
                    OR: [
                        { username: { contains: searchTerm, mode: 'insensitive' } },
                        { email: { contains: searchTerm, mode: 'insensitive' } },
                        { identification: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                },
                take: limit,
                orderBy: { username: 'asc' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    identification: true,
                    clientType: true,
                },
            })
            : await prisma.users.findMany({
                where: { role: 'client', isActive: true },
                take: limit,
                orderBy: { username: 'asc' },
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
            discountRate: undefined,
            clientType: u.clientType ?? undefined,
        }));

        return NextResponse.json({ success: true, clients });
    } catch (error: any) {
        console.error('Client search error:', error);
        return NextResponse.json({ error: 'Client search failed' }, { status: 500 });
    }
}
