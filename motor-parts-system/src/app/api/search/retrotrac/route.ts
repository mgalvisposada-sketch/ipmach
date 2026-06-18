import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/retrotrac?reference=XXX
 * POST /api/search/retrotrac { reference: "XXX" }
 * Search Retrotrac via Deep Search Service
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const reference = searchParams.get('reference');

        if (!reference || !reference.trim()) {
            return NextResponse.json({ error: 'Reference parameter is required' }, { status: 400 });
        }

        // Call the deep web endpoint
        const response = await fetch(`${request.nextUrl.origin}/api/search/deep-web/RETROTRAC`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference: reference.trim() }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('[RETROTRAC] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { reference } = await request.json();

        if (!reference || typeof reference !== 'string' || !reference.trim()) {
            return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
        }

        // Call the deep web endpoint
        const response = await fetch(`${request.nextUrl.origin}/api/search/deep-web/RETROTRAC`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference: reference.trim() }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('[RETROTRAC] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
