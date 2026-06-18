import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/users/[id]/source-config
 * Get client's source configuration
 */
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
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID' },
                { status: 400 }
            );
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                sourceConfig: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Only allow clients to access their own config, or admins to access any
        if (user.role !== 'client') {
            return NextResponse.json(
                { error: 'Source configuration is only available for client users' },
                { status: 400 }
            );
        }

        // Check if user is accessing their own config or is an admin
        const isOwnConfig = parseInt(session.user.id) === userId;
        const isAdmin = session.user.role === 'admin';

        if (!isOwnConfig && !isAdmin) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            sourceConfig: user.sourceConfig || { sources: [] },
        });
    } catch (error) {
        console.error('Error fetching source config:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

