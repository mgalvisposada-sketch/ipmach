import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = (searchParams.get('q') || '').trim();
        if (!q) {
            return NextResponse.json({ suggestions: [] });
        }

        // No Stock Service: suggestions are not available; COSTEX does not expose suggest-by-prefix
        return NextResponse.json({ suggestions: [] });
    } catch (error) {
        console.error('Suggest API error:', error);
        return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
}
