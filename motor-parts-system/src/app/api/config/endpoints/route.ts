import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get all active deep web endpoints
        const endpoints = await (prisma as any).deepWebEndpoint.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                originCode: true,
                name: true,
                isActive: true,
                requiresLogin: true,
            },
            orderBy: {
                id: 'asc',
            },
        });

        return NextResponse.json({
            success: true,
            endpoints: endpoints || [],
        });
    } catch (error: any) {
        console.error('Endpoints API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch endpoints' },
            { status: 500 }
        );
    }
}


