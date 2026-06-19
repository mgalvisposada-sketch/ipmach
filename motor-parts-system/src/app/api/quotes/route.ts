import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { normalizeQuoteItemsForStorage, sumQuoteLineTotals } from '@/lib/utils';

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      items,
      clientId,
      clientName,
      clientType,
      observations,
      createdByClient
    } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const normalizedItems = normalizeQuoteItemsForStorage(items);
    const computedTotal = sumQuoteLineTotals(normalizedItems);
    if (computedTotal <= 0) {
      return NextResponse.json(
        { error: 'Total amount must be greater than 0' },
        { status: 400 }
      );
    }

    let validatedTotalAmount: number;
    try {
      validatedTotalAmount = validateAndRoundAmount(computedTotal);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Invalid total amount' },
        { status: 400 }
      );
    }

    // Determine agentId based on who is creating the quote
    let agentId: number;
    if (createdByClient && session.user.role === 'client') {
      agentId = 0; // Sin agente asignado
      // Validar que el clientId coincida con el usuario logueado
      if (clientId !== parseInt(session.user.id)) {
        return NextResponse.json(
          { error: 'Cannot create quote for another client' },
          { status: 403 }
        );
      }
    } else {
      // Cotizacion normal de agente/admin
      agentId = parseInt(session.user.id);
      
      if (!agentId || agentId <= 0) {
        return NextResponse.json(
          { error: 'Invalid agent ID' },
          { status: 400 }
        );
      }

      // Verify that the agent exists in the database
      const agent = await prisma.users.findUnique({
        where: { id: agentId },
        select: { id: true, username: true, isActive: true }
      });

      if (!agent) {
        return NextResponse.json(
          {
            error: 'Agent not found. Please log out and log in again to refresh your session.',
            code: 'AGENT_NOT_FOUND',
            agentId: agentId
          },
          { status: 404 }
        );
      }

      if (!agent.isActive) {
        return NextResponse.json(
          { error: 'Agent account is inactive' },
          { status: 403 }
        );
      }
    }

    // Create the quote in the database (use UncheckedInput to pass agentId scalar)
    const quote = await prisma.quotes.create({
      data: {
        agentId,
        clientId: clientId ?? null,
        clientName: clientName ?? null,
        clientType: clientType ?? null,
        items: normalizedItems,
        status: 'running',
        totalAmount: validatedTotalAmount,
        observations: observations ?? null,
        createdByClient: createdByClient ?? false,
      } as import('@prisma/client').Prisma.QuotesUncheckedCreateInput,
    });

    // Create a quote log entry
    await prisma.quoteLogs.create({
      data: {
        quoteId: quote.id,
        status: 'running',
        clientId: clientId || null,
        agentId,
        totalAmount: validatedTotalAmount,
        itemCount: items.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: quote.id,
        agentId: quote.agentId,
        clientId: quote.clientId,
        clientName: quote.clientName,
        clientType: quote.clientType,
        items: quote.items,
        status: quote.status,
        totalAmount: quote.totalAmount,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Quote creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Support both legacy limit/offset and new page/pageSize based pagination
    const hasLegacyPagination = searchParams.has('limit') || searchParams.has('offset');

    let limit: number;
    let offset: number;
    let page: number;
    let pageSize: number;

    if (hasLegacyPagination) {
      // Backwards compatible behaviour
      limit = parseInt(searchParams.get('limit') || '50');
      offset = parseInt(searchParams.get('offset') || '0');
      pageSize = limit;
      page = Math.floor(offset / Math.max(pageSize, 1)) + 1;
    } else {
      // New page/pageSize based pagination
      page = parseInt(searchParams.get('page') || '1');
      pageSize = parseInt(searchParams.get('pageSize') || '20');

      if (!Number.isFinite(page) || page < 1) page = 1;
      if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 200) pageSize = 20;

      limit = pageSize;
      offset = (page - 1) * pageSize;
    }

    // Build where clause based on user role and query parameters
    let whereClause: any = {};

    if (session.user.role === 'client') {
      // Clientes solo ven sus propias cotizaciones
      whereClause.clientId = parseInt(session.user.id);
    } else if (session.user.role !== 'admin') {
      // Agentes solo ven sus cotizaciones
      whereClause.agentId = parseInt(session.user.id);
    } else if (agentId) {
      // Admin puede filtrar por agente
      whereClause.agentId = parseInt(agentId);
    }

    if (clientId) {
      whereClause.clientId = parseInt(clientId);
    }

    if (status) {
      whereClause.status = status;
    }

    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    const quotes = await prisma.quotes.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Fetch agent information for each quote
    const quotesWithAgents = await Promise.all(
      quotes.map(async (quote) => {
        const agent = await prisma.users.findUnique({
          where: { id: quote.agentId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        });
        return {
          ...quote,
          agent,
        };
      })
    );

    const totalCount = await prisma.quotes.count({
      where: whereClause,
    });

    const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1)));

    return NextResponse.json({
      success: true,
      data: quotesWithAgents,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        page,
        pageSize,
        totalPages,
      },
    });

  } catch (error: any) {
    console.error('Quote retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve quotes' },
      { status: 500 }
    );
  }
}