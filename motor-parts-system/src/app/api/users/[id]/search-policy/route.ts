import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;
        const userId = parseInt(id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
        }

        const body = await request.json();
        const searchAllowed =
            typeof body.searchAllowed === 'boolean' ? body.searchAllowed : undefined;
        let searchQuotaLimit: number | null | undefined = undefined;
        if (Object.prototype.hasOwnProperty.call(body, 'searchQuotaLimit')) {
            if (body.searchQuotaLimit === null) searchQuotaLimit = null;
            else if (
                typeof body.searchQuotaLimit === 'number' &&
                body.searchQuotaLimit >= 0
            )
                searchQuotaLimit = body.searchQuotaLimit;
        }
        let clientType: number | null | undefined = undefined;
        if (Object.prototype.hasOwnProperty.call(body, 'clientType')) {
            if (body.clientType === null || body.clientType === '') clientType = null;
            else {
                const n = typeof body.clientType === 'number' ? body.clientType : parseInt(body.clientType, 10);
                if (Number.isFinite(n) && n >= 0 && n <= 99) clientType = n;
            }
        }

        if (
            searchAllowed === undefined &&
            searchQuotaLimit === undefined &&
            clientType === undefined
        ) {
            return NextResponse.json(
                { error: 'Provide at least one of searchAllowed, searchQuotaLimit or clientType' },
                { status: 400 }
            );
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (user.role !== 'client') {
            return NextResponse.json(
                { error: 'Search policy only applies to clients' },
                { status: 400 }
            );
        }

        const updateData: {
            searchAllowed?: boolean;
            searchQuotaLimit?: number | null;
            clientType?: number | null;
        } = {};
        if (searchAllowed !== undefined) updateData.searchAllowed = searchAllowed;
        if (searchQuotaLimit !== undefined) updateData.searchQuotaLimit = searchQuotaLimit;
        if (clientType !== undefined) updateData.clientType = clientType;

        await prisma.users.update({
            where: { id: userId },
            data: updateData,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating search policy:', error);
        return NextResponse.json(
            { error: 'Failed to update search policy' },
            { status: 500 }
        );
    }
}
