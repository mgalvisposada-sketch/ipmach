import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

// Helper function to validate and round decimal amounts
// Decimal(12, 2) allows max 9,999,999,999.99
const MAX_DECIMAL_VALUE = 9999999999.99;

function validateAndRoundAmount(value: number | string): number {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (!Number.isFinite(numValue)) {
    throw new Error('Invalid numeric value');
  }
  
  if (Math.abs(numValue) > MAX_DECIMAL_VALUE) {
    throw new Error(`Amount exceeds maximum allowed value of ${MAX_DECIMAL_VALUE.toLocaleString()}`);
  }
  
  // Round to 2 decimal places
  return Math.round(numValue * 100) / 100;
}

// Update discount/IVA fields for a quote
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const quoteId = parseInt(id, 10);
        if (!Number.isFinite(quoteId) || quoteId <= 0) {
            return NextResponse.json({ error: 'Invalid quote id' }, { status: 400 });
        }

        const body = await request.json();
        const discountPercentRaw = body?.discountPercent;
        const ivaPercentRaw = body?.ivaPercent;
        const status = body?.status;
        const observations = body?.observations;
        const requestItems = body?.items;
        // const cancellationReason = body?.cancellationReason; // Temporarily commented out

        // Only validate discount and IVA if they are provided
        let discountPercent: number | undefined;
        let ivaPercent: number | undefined;

        if (discountPercentRaw !== undefined) {
            discountPercent = Number(discountPercentRaw);
            if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
                return NextResponse.json({ error: 'discountPercent must be between 0 and 100' }, { status: 400 });
            }
        }

        if (ivaPercentRaw !== undefined) {
            ivaPercent = Number(ivaPercentRaw);
            if (!Number.isFinite(ivaPercent) || ivaPercent < 0 || ivaPercent > 100) {
                return NextResponse.json({ error: 'ivaPercent must be between 0 and 100' }, { status: 400 });
            }
        }

        // Validate status if provided
        if (status) {
            const validStatuses = ['running', 'hot', 'warm', 'cold', 'closed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return NextResponse.json({ error: 'Invalid status. Must be one of: running, hot, warm, cold, closed, cancelled' }, { status: 400 });
            }
        }

        // Temporarily commented out - cancellation reason validation
        // if (status === 'cancelled') {
        //     if (!cancellationReason || !cancellationReason.trim()) {
        //         return NextResponse.json({ error: 'Cancellation reason is required when status is cancelled' }, { status: 400 });
        //     }
        //     if (cancellationReason.length > 500) {
        //         return NextResponse.json({ error: 'Cancellation reason must be 500 characters or less' }, { status: 400 });
        //     }
        // }

        // Fetch current quote and compute totals server-side
        const existing = await prisma.quotes.findUnique({ where: { id: quoteId } });
        if (!existing) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }

        // Use request items if provided, otherwise use existing items
        const items: any[] = requestItems && Array.isArray(requestItems)
            ? requestItems
            : Array.isArray(existing.items as any)
                ? ((existing.items as unknown) as any[])
                : [];

        const subtotal = items.reduce((sum, it) => {
            const quantity = Number(typeof it?.quantity === 'number' ? it.quantity : 1);
            const unit = Number(
                typeof it?.unitPrice === 'number'
                    ? it.unitPrice
                    : typeof it?.basePriceCOP === 'number'
                        ? it.basePriceCOP
                        : 0
            );
            const total = Number(
                typeof it?.totalPrice === 'number' ? it.totalPrice : unit * quantity
            );
            return sum + (Number.isFinite(total) ? total : 0);
        }, 0);

        // Use provided values or fall back to existing values
        const finalDiscountPercent = discountPercent !== undefined ? discountPercent : (existing.discountPercent ? Number(existing.discountPercent) : 0);
        const finalIvaPercent = ivaPercent !== undefined ? ivaPercent : (existing.ivaPercent ? Number(existing.ivaPercent) : 19);

        const discountAmount = subtotal * (finalDiscountPercent / 100);
        const discountedBase = subtotal - discountAmount;
        const ivaAmount = discountedBase * (finalIvaPercent / 100);
        const totalAmountRaw = discountedBase + ivaAmount;
        
        // Validate and round totalAmount
        let totalAmount: number;
        try {
          totalAmount = validateAndRoundAmount(totalAmountRaw);
        } catch (error: any) {
          return NextResponse.json(
            { error: error.message || 'Calculated total amount exceeds maximum allowed value' },
            { status: 400 }
          );
        }
        
        // Also validate and round discountAmount and ivaAmount
        let validatedDiscountAmount: number | undefined;
        let validatedIvaAmount: number | undefined;
        
        if (discountPercent !== undefined) {
          try {
            validatedDiscountAmount = validateAndRoundAmount(discountAmount);
          } catch (error: any) {
            return NextResponse.json(
              { error: 'Calculated discount amount exceeds maximum allowed value' },
              { status: 400 }
            );
          }
        }
        
        if (ivaPercent !== undefined) {
          try {
            validatedIvaAmount = validateAndRoundAmount(ivaAmount);
          } catch (error: any) {
            return NextResponse.json(
              { error: 'Calculated IVA amount exceeds maximum allowed value' },
              { status: 400 }
            );
          }
        }

        const updated = await prisma.quotes.update({
            where: { id: quoteId },
            data: {
                ...(status && { status: status }),
                ...(requestItems && { items: requestItems }),
                ...(observations !== undefined && { observations: observations || null }),
                // Temporarily commented out - cancellation reason handling
                // ...(status === 'cancelled' && cancellationReason && { cancellationReason: cancellationReason.trim() }),
                // ...(status !== 'cancelled' && { cancellationReason: null }),
                ...(discountPercent !== undefined && { discountPercent: finalDiscountPercent }),
                ...(discountPercent !== undefined && validatedDiscountAmount !== undefined && { discountAmount: validatedDiscountAmount }),
                ...(ivaPercent !== undefined && { ivaPercent: finalIvaPercent }),
                ...(ivaPercent !== undefined && validatedIvaAmount !== undefined && { ivaAmount: validatedIvaAmount }),
                totalAmount: totalAmount,
            },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating quote:', error);
        return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }
}

// Optional: get single quote
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
        const quoteId = parseInt(id, 10);
        if (!Number.isFinite(quoteId) || quoteId <= 0) {
            return NextResponse.json({ error: 'Invalid quote id' }, { status: 400 });
        }
        const quote = await prisma.quotes.findUnique({ where: { id: quoteId } });
        if (!quote) {
            return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: quote });
    } catch (error) {
        console.error('Error fetching quote:', error);
        return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
    }
}


