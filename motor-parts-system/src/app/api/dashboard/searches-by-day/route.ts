import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const isAdmin = session.user.role === 'admin';
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const where = {
            timestamp: { gte: sevenDaysAgo, lte: now },
            ...(isAdmin ? {} : { userId }),
        };

        const logs = await prisma.searchLogs.findMany({
            where,
            select: { timestamp: true },
        });

        const dayKey = (d: Date) => d.toISOString().slice(0, 10);
        const byDay: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            byDay[dayKey(d)] = 0;
        }
        logs.forEach((log) => {
            const key = dayKey(new Date(log.timestamp));
            if (byDay[key] !== undefined) byDay[key]++;
        });

        const data = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching searches by day:', error);
        return NextResponse.json(
            { error: 'Failed to fetch searches by day' },
            { status: 500 }
        );
    }
}
