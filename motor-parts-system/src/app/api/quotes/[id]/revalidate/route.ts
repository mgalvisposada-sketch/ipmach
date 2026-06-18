import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface RevalidationChange {
    reference: string;
    oldPrice: number;
    newPrice: number;
    oldStock: number;
    newStock: number;
    priceChanged: boolean;
    stockChanged: boolean;
    stockDecreased: boolean;
    /** Cost (raw, before profit) from source - e.g. Costex baseCostUSD. Use to update item.basePriceCOP when applying revalidation. */
    newCost?: number;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const quoteId = parseInt(id);

        // Fetch quote
        const quote = await prisma.quotes.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                clientId: true,
                clientType: true,
                items: true,
                status: true,
            },
        });

        if (!quote) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }

        // Validar permisos: solo el cliente dueño puede re-validar su cotización
        if (session.user.role === 'client' && quote.clientId !== parseInt(session.user.id)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const items = quote.items as any[];
        const changes: RevalidationChange[] = [];

        // Re-consultar cada item en su fuente original
        for (const item of items) {
            const origin = item.origin; // 'costex', 'agrocosta', etc.
            const reference = item.reference;
            const oldPrice = item.unitPrice;
            const oldStock = item.stockQty || 0;

            let newPrice = oldPrice;
            let newStock = oldStock;
            let newCost: number | undefined;

            try {
                if (origin === 'costex') {
                    // Re-consultar Costex
                    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/search/costex`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            partNumber: reference,
                            clientType: quote.clientType,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        newPrice = data.data?.minPriceUSD || oldPrice;
                        newStock = data.data?.totalStock || 0;
                        const costUSD = data.data?.baseCostUSD ?? data.data?.calculation?.inputs?.baseCostUSD;
                        if (typeof costUSD === 'number' && Number.isFinite(costUSD)) {
                            newCost = costUSD;
                        }
                    }
                } else if (origin) {
                    // Re-consultar Deep Web source
                    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/search/deep-web/${origin}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reference: reference,
                            clientId: quote.clientId,
                            clientType: quote.clientType,
                        }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.products && data.products.length > 0) {
                            newPrice = data.products[0].price || oldPrice;
                            newStock = data.products[0].stock || 0;
                        }
                    }
                }

                // Detectar cambios significativos
                const priceChanged = Math.abs(newPrice - oldPrice) > 0.01;
                const stockChanged = newStock !== oldStock;
                const stockDecreased = newStock < oldStock;

                if (priceChanged || stockDecreased) {
                    changes.push({
                        reference,
                        oldPrice,
                        newPrice,
                        oldStock,
                        newStock,
                        priceChanged,
                        stockChanged,
                        stockDecreased,
                        ...(newCost !== undefined && { newCost }),
                    });
                }
            } catch (error) {
                console.error(`Error revalidating ${reference}:`, error);
                // Continuar con el siguiente item
            }
        }

        return NextResponse.json({
            success: true,
            hasChanges: changes.length > 0,
            changes,
        });
    } catch (error: any) {
        console.error('Revalidation error:', error);
        return NextResponse.json(
            { error: 'Failed to revalidate quote' },
            { status: 500 }
        );
    }
}
