import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

interface OrderItem {
  reference: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only admins can access this endpoint
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const reference = decodeURIComponent(params.reference);
    const normalizedRef = normalizeReference(reference);

    console.log('Client detail API for reference:', reference);

    // Get all searches for this reference
    const searches = await prisma.searchLogs.findMany({
      where: {
        searchTerm: {
          mode: 'insensitive',
          equals: reference,
        },
        userId: {
          not: null,
        },
      },
      select: {
        id: true,
        searchTerm: true,
        timestamp: true,
        userId: true,
        hasStock: true,
        resultCount: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group searches by client
    const clientSearchMap = new Map<
      number,
      {
        searchCount: number;
        firstSearch: Date;
        lastSearch: Date;
        searches: typeof searches;
      }
    >();

    searches.forEach((search) => {
      if (search.userId === null) return;

      if (!clientSearchMap.has(search.userId)) {
        clientSearchMap.set(search.userId, {
          searchCount: 0,
          firstSearch: search.timestamp,
          lastSearch: search.timestamp,
          searches: [],
        });
      }

      const clientData = clientSearchMap.get(search.userId)!;
      clientData.searchCount++;
      clientData.searches.push(search);

      if (search.timestamp < clientData.firstSearch) {
        clientData.firstSearch = search.timestamp;
      }
      if (search.timestamp > clientData.lastSearch) {
        clientData.lastSearch = search.timestamp;
      }
    });

    // Get client details
    const clientIds = Array.from(clientSearchMap.keys());
    const clients = await prisma.users.findMany({
      where: {
        id: {
          in: clientIds,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
      },
    });

    // Get orders that include this reference
    const orders = await prisma.orders.findMany({
      where: {
        clientId: {
          in: clientIds,
        },
        status: {
          notIn: ['cancelled'],
        },
      },
      select: {
        id: true,
        clientId: true,
        items: true,
        createdAt: true,
        totalAmount: true,
        status: true,
      },
    });

    // Build client analysis
    const clientAnalysis = clients.map((client) => {
      const searchData = clientSearchMap.get(client.id);
      if (!searchData) return null;

      // Find orders by this client that include the reference
      const clientOrders = orders.filter((order) => {
        if (order.clientId !== client.id) return false;

        const items: OrderItem[] = Array.isArray(order.items)
          ? order.items
          : JSON.parse((order.items as any) || '[]');

        return items.some(
          (item) => normalizeReference(item.reference) === normalizedRef
        );
      });

      const converted = clientOrders.length > 0;
      const firstOrder = converted
        ? clientOrders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
        : null;

      // Calculate time to purchase (days from first search to first order)
      const timeToPurchase =
        converted && firstOrder
          ? differenceInDays(firstOrder.createdAt, searchData.firstSearch)
          : null;

      // Calculate total order value for this reference
      let orderValue = 0;
      if (converted) {
        clientOrders.forEach((order) => {
          const items: OrderItem[] = Array.isArray(order.items)
            ? order.items
            : JSON.parse((order.items as any) || '[]');

          items.forEach((item) => {
            if (normalizeReference(item.reference) === normalizedRef) {
              orderValue += item.totalPrice || 0;
            }
          });
        });
      }

      // Calculate average search frequency (searches per day)
      const daysSinceFirstSearch = differenceInDays(
        searchData.lastSearch,
        searchData.firstSearch
      );
      const avgSearchFrequency =
        daysSinceFirstSearch > 0
          ? searchData.searchCount / daysSinceFirstSearch
          : searchData.searchCount;

      return {
        clientId: client.id,
        clientName: client.username,
        email: client.email,
        phoneNumber: client.phoneNumber || null,
        searchCount: searchData.searchCount,
        firstSearch: searchData.firstSearch.toISOString(),
        lastSearch: searchData.lastSearch.toISOString(),
        converted,
        orderDate: firstOrder ? firstOrder.createdAt.toISOString() : null,
        orderValue: converted ? Math.round(orderValue * 100) / 100 : null,
        timeToPurchase,
        avgSearchFrequency: Math.round(avgSearchFrequency * 100) / 100,
        orderCount: clientOrders.length,
      };
    }).filter(Boolean);

    // Calculate summary statistics
    const totalClients = clientAnalysis.length;
    const convertedClients = clientAnalysis.filter((c) => c?.converted).length;
    const conversionRate = totalClients > 0 ? (convertedClients / totalClients) * 100 : 0;

    const timesToPurchase = clientAnalysis
      .map((c) => c?.timeToPurchase)
      .filter((t): t is number => t !== null);
    const avgTimeToPurchase =
      timesToPurchase.length > 0
        ? timesToPurchase.reduce((sum, t) => sum + t, 0) / timesToPurchase.length
        : null;

    const orderValues = clientAnalysis
      .map((c) => c?.orderValue)
      .filter((v): v is number => v !== null);
    const avgOrderValue =
      orderValues.length > 0
        ? orderValues.reduce((sum, v) => sum + v, 0) / orderValues.length
        : 0;

    // Identify high-interest clients (multiple searches, not converted)
    const highInterestClients = clientAnalysis
      .filter((c) => c && !c.converted && c.searchCount >= 3)
      .map((c) => c!.clientName);

    // Get related references (other references searched by these clients)
    const relatedSearches = await prisma.searchLogs.findMany({
      where: {
        userId: {
          in: clientIds,
        },
      },
      select: {
        searchTerm: true,
      },
    });

    const relatedReferencesMap = new Map<string, number>();
    relatedSearches.forEach((search) => {
      const term = search.searchTerm.trim().toUpperCase();
      // Exclude the current reference
      if (term !== normalizedRef) {
        relatedReferencesMap.set(term, (relatedReferencesMap.get(term) || 0) + 1);
      }
    });

    const topRelatedReferences = Array.from(relatedReferencesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ref, count]) => ({ reference: ref, count }));

    return NextResponse.json({
      success: true,
      data: {
        reference,
        clients: clientAnalysis,
        summary: {
          totalClients,
          convertedClients,
          conversionRate: Math.round(conversionRate * 100) / 100,
          avgTimeToPurchase:
            avgTimeToPurchase !== null ? Math.round(avgTimeToPurchase) : null,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        },
        insights: {
          highInterestClients,
          topRelatedReferences,
        },
      },
    });
  } catch (error) {
    console.error('Error in client detail API:', error);
    return NextResponse.json(
      { error: 'Error al obtener detalle de clientes' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
