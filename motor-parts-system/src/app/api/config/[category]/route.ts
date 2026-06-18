import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ category: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { category } = await params;

        // Get configurations by category
        const configurations = await prisma.configuration.findMany({
            where: {
                category: category,
                isActive: true
            },
            orderBy: {
                key: 'asc'
            }
        });

        // Transform to key-value object
        const configMap = configurations.reduce((acc, config) => {
            acc[config.key] = {
                value: Number(config.value),
                description: config.description
            };
            return acc;
        }, {} as Record<string, { value: number; description: string | null }>);

        return NextResponse.json({
            success: true,
            data: configMap
        });

    } catch (error) {
        console.error('Configuration category API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch configuration' },
            { status: 500 }
        );
    }
}
