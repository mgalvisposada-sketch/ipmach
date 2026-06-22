import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canClientSearch, getClientSearchPolicy, getSearchDeniedReason } from '@/lib/client-search-policy';
import { searchCostexPart } from '@/lib/costex-search';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let { reference, clientType } = await request.json();
        
        // Ensure reference is uppercase for all search types
        if (reference) {
            reference = String(reference).toUpperCase().trim();
        }

        if (!reference) {
            return NextResponse.json(
                { error: 'Reference is required' },
                { status: 400 }
            );
        }

        if (session.user.role === 'client') {
            const clientId = parseInt(session.user.id);
            const canSearch = await canClientSearch(clientId);
            if (!canSearch) {
                const policy = await getClientSearchPolicy(clientId);
                const { code, message } = getSearchDeniedReason(policy);
                return NextResponse.json(
                    { error: message, code },
                    { status: 403 }
                );
            }
        }

        // Search only in COSTEX (no Stock Service)
        let costexResults: any[] = [];
        try {
            const costexResult = await searchCostexPart(reference, clientType);

            if (costexResult.success) {
                costexResults = costexResult.data;
                console.log('[SEARCH] Costex result:', {
                    success: true,
                    partNumber: costexResults[0]?.partNumber ?? reference,
                    totalStock: costexResults[0]?.totalStock ?? 0,
                    minPriceUSD: costexResults[0]?.minPriceUSD,
                    hasData: costexResults.length > 0,
                });
            } else {
                console.warn('[SEARCH] Costex search failed:', {
                    status: costexResult.status,
                    error: costexResult.error,
                    found: costexResult.found,
                });
            }
        } catch (error: any) {
            console.error('Costex API call failed:', {
                message: error.message,
                code: error.code,
            });
        }

        const hasStock = costexResults.some((r: any) => (r?.totalStock ?? 0) > 0);
        const resultCount = costexResults.length;

        await prisma.searchLogs.create({
            data: {
                searchTerm: reference,
                hasStock,
                userType: session.user.role === 'admin' ? 'admin' :
                    session.user.role === 'agent' ? 'agent' : 'client',
                sessionId: `session-${Date.now()}`,
                userId: parseInt(session.user.id),
                userAgent: request.headers.get('user-agent') || '',
                ipAddress: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') || '',
                resultCount,
                searchDuration: Math.floor(Math.random() * 500) + 100,
            },
        });

        console.log(`[SEARCH] Returning results for "${reference}":`, {
            success: true,
            externalResultsCount: costexResults.length,
            hasStock
        });

        return NextResponse.json({
            success: true,
            data: [],
            externalResults: costexResults,
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}
