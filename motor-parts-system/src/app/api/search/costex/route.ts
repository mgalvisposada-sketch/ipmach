import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchCostexPart } from '@/lib/costex-search';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let { partNumber: rawPartNumber, clientType } = await request.json();

        if (rawPartNumber) {
            rawPartNumber = String(rawPartNumber).toUpperCase().trim();
        }

        if (!rawPartNumber) {
            return NextResponse.json(
                { error: 'Part number is required' },
                { status: 400 }
            );
        }

        const result = await searchCostexPart(rawPartNumber, clientType);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    ...(result.found === false ? { found: false } : {}),
                },
                { status: result.status }
            );
        }

        console.log(
            `Costex search performed for part: ${rawPartNumber} by user: ${session.user.id} (${result.data.length} location row(s))`
        );

        return NextResponse.json({
            success: true,
            data: result.data,
            source: result.source,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack?.substring(0, 500) : undefined;
        console.error('[COSTEX-API] Search error:', { error: message, stack });
        return NextResponse.json(
            { error: 'External search failed' },
            { status: 500 }
        );
    }
}
