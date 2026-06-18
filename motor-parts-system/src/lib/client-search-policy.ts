import { prisma } from '@/lib/prisma';

export interface ClientSearchPolicy {
    allowed: boolean;
    quotaLimit: number | null;
    usedSinceLastOrder: number;
}

/**
 * Returns the search policy for a user. Only applies to role=client.
 * For non-clients, returns { allowed: true, quotaLimit: null, usedSinceLastOrder: 0 }.
 * usedSinceLastOrder = count of SearchLogs since last order (or since user creation if no orders).
 */
export async function getClientSearchPolicy(clientId: number): Promise<ClientSearchPolicy> {
    const user = await prisma.users.findUnique({
        where: { id: clientId },
        select: {
            role: true,
            searchAllowed: true,
            searchQuotaLimit: true,
            createdAt: true,
        },
    });

    if (!user || user.role !== 'client') {
        return { allowed: true, quotaLimit: null, usedSinceLastOrder: 0 };
    }

    const lastOrder = await prisma.orders.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });

    const since = lastOrder?.createdAt ?? user.createdAt;

    const usedSinceLastOrder = await prisma.searchLogs.count({
        where: {
            userId: clientId,
            timestamp: { gt: since },
        },
    });

    const allowed = user.searchAllowed === true;
    const quotaLimit = user.searchQuotaLimit ?? null;

    return {
        allowed,
        quotaLimit,
        usedSinceLastOrder,
    };
}

/**
 * Returns true if the client is allowed to perform a search (allowed and under quota).
 */
export async function canClientSearch(clientId: number): Promise<boolean> {
    const policy = await getClientSearchPolicy(clientId);
    if (!policy.allowed) return false;
    if (policy.quotaLimit === null) return true;
    return policy.usedSinceLastOrder < policy.quotaLimit;
}

/**
 * Returns a user-facing reason when search is denied (for 403 response).
 */
export function getSearchDeniedReason(policy: ClientSearchPolicy): { code: string; message: string } {
    if (!policy.allowed) {
        return {
            code: 'SEARCH_BLOCKED',
            message: 'Consultas suspendidas. Contacte al administrador.',
        };
    }
    if (policy.quotaLimit !== null && policy.usedSinceLastOrder >= policy.quotaLimit) {
        return {
            code: 'SEARCH_QUOTA_EXCEEDED',
            message:
                'Ha alcanzado su cupo de consultas para este período. Realice una orden de compra para renovar su cupo.',
        };
    }
    return { code: 'UNKNOWN', message: 'No puede realizar consultas en este momento.' };
}
