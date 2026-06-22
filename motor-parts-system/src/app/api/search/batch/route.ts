import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getClientSearchPolicy, getSearchDeniedReason } from '@/lib/client-search-policy';
import { searchCostexPart } from '@/lib/costex-search';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout

interface BatchSearchItem {
    reference: string;
    quantity: number;
}

interface BatchSearchRequest {
    references: BatchSearchItem[];
    clientId?: number;
    clientType?: number;
}

interface ProductResult {
    reference: string;
    price: number;
    clientPrice?: number;
    baseCostUSD?: number;
    stockQty: number;
    hasStock: boolean;
    location?: string;
    description?: string;
    source: 'costex' | 'deepweb' | 'internal';
    sourceName: string;
    origin?: string;
    costexLocationCode?: string;
}

interface BatchSearchResultItem {
    reference: string;
    requestedQty: number;
    status: 'found' | 'partial_stock' | 'not_found';
    availableQty: number;
    product?: ProductResult;
    source?: string;
    sourceName?: string;
    origin?: string;
}

function pickBestCostexRow(rows: any[]): any | null {
    if (!rows || rows.length === 0) return null;
    const withStock = rows.filter((r) => (r?.totalStock ?? 0) > 0);
    const pool = withStock.length > 0 ? withStock : rows;
    return pool.reduce((best, cur) =>
        (cur?.totalStock ?? 0) > (best?.totalStock ?? 0) ? cur : best
    );
}

/** Keeps concurrent internal /api/search/costex calls low so each one’s /api/config Prisma usage does not exhaust the pool. */
const BATCH_SEARCH_CONCURRENCY = Math.max(
    1,
    Math.min(10, Number(process.env.BATCH_SEARCH_CONCURRENCY) || 4)
);

async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    };

    const poolSize = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
    return results;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body: BatchSearchRequest = await request.json();
        const { references, clientId, clientType } = body;

        if (!references || !Array.isArray(references) || references.length === 0) {
            return NextResponse.json(
                { error: 'References array is required' },
                { status: 400 }
            );
        }

        // Limit to 100 references
        if (references.length > 100) {
            return NextResponse.json(
                { error: 'Maximum 100 references allowed per batch' },
                { status: 400 }
            );
        }

        // Validate each reference
        for (const item of references) {
            if (!item.reference || typeof item.reference !== 'string') {
                return NextResponse.json(
                    { error: 'Each reference must have a valid reference string' },
                    { status: 400 }
                );
            }
            if (typeof item.quantity !== 'number' || item.quantity < 1) {
                return NextResponse.json(
                    { error: 'Each reference must have a valid quantity (>= 1)' },
                    { status: 400 }
                );
            }
        }

        if (session.user.role === 'client') {
            const clientId = parseInt(session.user.id);
            const policy = await getClientSearchPolicy(clientId);
            if (!policy.allowed) {
                const { code, message } = getSearchDeniedReason(policy);
                return NextResponse.json({ error: message, code }, { status: 403 });
            }
            const countAfterBatch = policy.usedSinceLastOrder + references.length;
            if (policy.quotaLimit !== null && countAfterBatch > policy.quotaLimit) {
                const { code, message } = getSearchDeniedReason(policy);
                return NextResponse.json({ error: message, code }, { status: 403 });
            }
        }

        console.log(
            `[BATCH-SEARCH] Processing ${references.length} references (concurrency=${BATCH_SEARCH_CONCURRENCY})`
        );

        const results = await runWithConcurrency(
            references,
            BATCH_SEARCH_CONCURRENCY,
            async (item): Promise<BatchSearchResultItem> => {
                try {
                    const costexResult = await searchCostexPart(item.reference, clientType);

                    if (costexResult.success && costexResult.data.length > 0) {
                        const costexData = pickBestCostexRow(costexResult.data);
                        if (!costexData) {
                            return {
                                reference: item.reference,
                                requestedQty: item.quantity,
                                status: 'not_found',
                                availableQty: 0,
                            };
                        }
                        const stock = costexData.totalStock || 0;
                        const price = costexData.minPriceUSD || costexData.minPriceCOP || 0;

                        if (stock > 0) {
                            const baseCostUSD =
                                costexData.baseCostUSD ?? costexData.calculation?.inputs?.baseCostUSD;
                            const result: ProductResult = {
                                reference: item.reference,
                                price: price,
                                clientPrice: price,
                                baseCostUSD:
                                    typeof baseCostUSD === 'number' && Number.isFinite(baseCostUSD)
                                        ? baseCostUSD
                                        : undefined,
                                stockQty: stock,
                                hasStock: true,
                                location: costexData.locations
                                    ? Object.keys(costexData.locations).join(', ')
                                    : undefined,
                                description: costexData.description || `Costex - ${item.reference}`,
                                source: 'costex',
                                sourceName: 'Costex',
                                origin: 'costex',
                                ...(typeof costexData.sourceLocationCode === 'string'
                                    ? { costexLocationCode: costexData.sourceLocationCode }
                                    : {}),
                            };

                            if (stock < item.quantity) {
                                return {
                                    reference: item.reference,
                                    requestedQty: item.quantity,
                                    status: 'partial_stock',
                                    availableQty: stock,
                                    product: result,
                                    source: 'costex',
                                    sourceName: 'Costex',
                                };
                            }

                            return {
                                reference: item.reference,
                                requestedQty: item.quantity,
                                status: 'found',
                                availableQty: stock,
                                product: result,
                                source: 'costex',
                                sourceName: 'Costex',
                            };
                        }
                    }

                    return {
                        reference: item.reference,
                        requestedQty: item.quantity,
                        status: 'not_found',
                        availableQty: 0,
                    };
                } catch (error) {
                    console.error(`[BATCH-SEARCH] Error searching reference ${item.reference}:`, error);
                    return {
                        reference: item.reference,
                        requestedQty: item.quantity,
                        status: 'not_found',
                        availableQty: 0,
                    };
                }
            }
        );

        if (session.user.role === 'client') {
            const userId = parseInt(session.user.id);
            const sessionId = `session-${Date.now()}`.slice(0, 100);
            const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
            const ipAddress = (
                request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                ''
            ).slice(0, 45);

            await prisma.searchLogs.createMany({
                data: results.map((r) => ({
                    searchTerm: r.reference.slice(0, 100),
                    hasStock: (r.availableQty ?? 0) > 0,
                    userType: 'client' as const,
                    sessionId,
                    userId,
                    userAgent: userAgent || null,
                    ipAddress: ipAddress || null,
                    resultCount: r.product ? 1 : 0,
                    searchDuration: 0,
                })),
            });
        }

        // Calculate summary
        const summary = {
            total: results.length,
            found: results.filter(r => r.status === 'found').length,
            partialStock: results.filter(r => r.status === 'partial_stock').length,
            notFound: results.filter(r => r.status === 'not_found').length
        };

        console.log(`[BATCH-SEARCH] Complete: ${summary.found} found, ${summary.partialStock} partial, ${summary.notFound} not found`);

        return NextResponse.json({
            success: true,
            results,
            summary
        });

    } catch (error: any) {
        console.error('[BATCH-SEARCH] Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message || 'Internal server error' 
            },
            { status: 500 }
        );
    }
}
