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

        // Get all active configurations
        const configurations = await prisma.configuration.findMany({
            where: {
                isActive: true
            },
            orderBy: {
                category: 'asc'
            }
        });

        // Transform to key-value object for easier access
        const configMap = configurations.reduce((acc, config) => {
            acc[config.key] = {
                value: Number(config.value),
                description: config.description,
                category: config.category
            };
            return acc;
        }, {} as Record<string, { value: number; description: string | null; category: string }>);

        return NextResponse.json({
            success: true,
            data: configMap
        });

    } catch (error) {
        console.error('Configuration API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch configuration' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { key, value, description, category } = await request.json();

        if (!key || value === undefined || !category) {
            return NextResponse.json(
                { error: 'Key, value, and category are required' },
                { status: 400 }
            );
        }

        // Upsert configuration
        const configuration = await prisma.configuration.upsert({
            where: { key },
            update: {
                value,
                description,
                category,
                updatedAt: new Date()
            },
            create: {
                key,
                value,
                description,
                category
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: configuration.id,
                key: configuration.key,
                value: Number(configuration.value),
                description: configuration.description,
                category: configuration.category
            }
        });

    } catch (error) {
        console.error('Configuration update error:', error);
        return NextResponse.json(
            { error: 'Failed to update configuration' },
            { status: 500 }
        );
    }
}
