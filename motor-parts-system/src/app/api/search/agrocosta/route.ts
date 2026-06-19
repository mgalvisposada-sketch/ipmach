import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Product } from '@/lib/parsers/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/agrocosta?reference=XXX
 * POST /api/search/agrocosta { reference: "XXX" }
 * Search AgroCosta via Deep Search Service
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        let reference = searchParams.get('reference');
        if (reference) {
            reference = reference.toUpperCase().trim();
        }

        if (!reference) {
            return NextResponse.json({ error: 'Reference parameter is required' }, { status: 400 });
        }

        // Call the deep web endpoint
        const response = await fetch(`${request.nextUrl.origin}/api/search/deep-web/AGROCOSTA`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference: reference.trim() }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('[AGROCOSTA] Error:', error);
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

        let { reference } = await request.json();

        if (reference) {
            reference = String(reference).toUpperCase().trim();
        }

        if (!reference) {
            return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
        }

        // Call the deep web endpoint
        const response = await fetch(`${request.nextUrl.origin}/api/search/deep-web/AGROCOSTA`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference: reference.trim() }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('[AGROCOSTA] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
