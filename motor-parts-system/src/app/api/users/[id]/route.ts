import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { syncMotorUserToFilipo, type FilipoSyncCreditOptions, type FilipoSyncResult } from '@/lib/filipo-client-sync';
import { getExternalPendingByClientUserId } from '@/lib/external-billing';
import { getPortfolioBlockStateForClientUserId } from '@/lib/portfolio-receivables';
import { getFilipoClientCreditForUserId } from '@/lib/filipo-client-credit';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID' },
                { status: 400 }
            );
        }

        const result = await getUserById(userId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to fetch user' },
                { status: 500 }
            );
        }

        if (!result.user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const data = { ...result.user } as Record<string, unknown>;
        const allowOrdersWithOverduePortfolio = Boolean(
            (result.user as Record<string, unknown>).allowOrdersWithOverduePortfolio
        );
        if (result.user.role === 'client') {
            const filipo = await getFilipoClientCreditForUserId(userId);
            const hasCreditLine = Boolean(filipo?.creditEnabled);
            const creditLimitNum = filipo?.creditLimit ?? 0;
            (data as Record<string, unknown>).hasCredit = hasCreditLine;
            (data as Record<string, unknown>).creditLimit = filipo ? creditLimitNum : null;
            (data as Record<string, unknown>).filipoCreditDaysLimit =
                filipo != null ? filipo.creditDaysLimit : null;

            if (hasCreditLine && filipo) {
                const { pendingAmount: externalDebt } = await getExternalPendingByClientUserId(userId);
                const pendingSum = await prisma.orders.aggregate({
                    where: {
                        clientId: userId,
                        status: { in: ['pending', 'processing'] },
                    },
                    _sum: { totalAmount: true },
                });
                const pendingOrdersSum =
                    pendingSum._sum.totalAmount != null ? Number(pendingSum._sum.totalAmount) : 0;
                const availableCredit = Math.max(0, creditLimitNum - externalDebt);
                (data as Record<string, unknown>).externalDebt = externalDebt;
                (data as Record<string, unknown>).pendingOrdersSum = pendingOrdersSum;
                (data as Record<string, unknown>).availableCredit = availableCredit;
                const portfolio = await getPortfolioBlockStateForClientUserId(userId, {
                    filipoCreditDaysLimit: filipo.creditDaysLimit,
                });
                (data as Record<string, unknown>).portfolioBlocked =
                    portfolio.blocked && !allowOrdersWithOverduePortfolio;
                (data as Record<string, unknown>).portfolioBlockMessage =
                    portfolio.blocked && !allowOrdersWithOverduePortfolio
                        ? portfolio.message ?? null
                        : null;
                (data as Record<string, unknown>).portfolioOverdueCount = portfolio.overdueCount;
            } else {
                (data as Record<string, unknown>).availableCredit = 0;
                (data as Record<string, unknown>).portfolioBlocked = false;
                (data as Record<string, unknown>).portfolioBlockMessage = null;
                (data as Record<string, unknown>).portfolioOverdueCount = 0;
            }
        }

        return NextResponse.json({
            success: true,
            data,
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID' },
                { status: 400 }
            );
        }

        const body = (await request.json()) as Record<string, unknown>;
        const {
            username,
            email,
            phoneNumber,
            role,
            isActive,
            sourceConfig,
            identification,
            clientType,
            hasCredit,
            creditLimit,
            password,
            isCompany,
            clientName,
            phoneCountryCode,
            country,
            stateOrDepartment,
            city,
            address,
            marketingSource,
            surveyCatPct,
            surveyKomatsuPct,
            surveyJohnDeerePct,
            allowOrdersWithOverduePortfolio,
            incoterm,
        } = body;

        const filipoCreditOpts: FilipoSyncCreditOptions = { syncCredit: true };
        if ('filipoCreditDaysLimit' in body) {
            const raw = body.filipoCreditDaysLimit;
            if (raw !== null && raw !== undefined && raw !== '') {
                const n = Number(raw);
                if (Number.isFinite(n) && n >= 0) {
                    filipoCreditOpts.creditDaysLimit = Math.floor(n);
                }
            }
        }

        // Validar contraseña si se proporcionó
        if (password !== undefined) {
            if (typeof password !== 'string' || password.trim().length < 6) {
                return NextResponse.json(
                    { error: 'Password must be at least 6 characters long' },
                    { status: 400 }
                );
            }
        }

        // Validate role if provided
        if (role !== undefined && role !== null) {
            const allowedRoles = new Set(['admin', 'agent', 'client']);
            if (typeof role !== 'string' || !allowedRoles.has(role)) {
                return NextResponse.json(
                    { error: 'Invalid role. Must be admin, agent, or client' },
                    { status: 400 }
                );
            }
        }

        // Validate sourceConfig structure if provided
        if (sourceConfig !== undefined && sourceConfig !== null) {
            if (typeof sourceConfig !== 'object' || Array.isArray(sourceConfig)) {
                return NextResponse.json(
                    { error: 'Invalid sourceConfig format. Expected { sources: [...] }' },
                    { status: 400 }
                );
            }
            const sourceConfigObj = sourceConfig as Record<string, unknown>;
            if (!Array.isArray(sourceConfigObj.sources)) {
                return NextResponse.json(
                    { error: 'Invalid sourceConfig format. Expected { sources: [...] }' },
                    { status: 400 }
                );
            }

            // Validate each source entry
            for (const source of sourceConfigObj.sources as Array<Record<string, unknown>>) {
                if (!source.originCode || typeof source.enabled !== 'boolean' || typeof source.profitValue !== 'number') {
                    return NextResponse.json(
                        { error: 'Invalid source entry. Each source must have originCode, enabled (boolean), and profitValue (number)' },
                        { status: 400 }
                    );
                }
                if (source.profitValue <= 0 || source.profitValue >= 1) {
                    return NextResponse.json(
                        { error: 'Profit value (divisor) must be between 0 and 1 (e.g., 0.6 for price / 0.6)' },
                        { status: 400 }
                    );
                }
            }
        }

        // Validate clientType if provided (0-99 to support e.g. 14=CIPARCOL, 15=PREMIUM, 16=AA, 17=A)
        if (clientType !== undefined && clientType !== null) {
            const clientTypeNum = Number(clientType);
            if (!Number.isFinite(clientTypeNum) || clientTypeNum < 0 || clientTypeNum > 99) {
                return NextResponse.json(
                    { error: 'Invalid clientType. Must be a number between 0 and 99' },
                    { status: 400 }
                );
            }
        }

        const safeNumber = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const n = Number(val);
            return isNaN(n) ? undefined : n;
        };

        const safeInt = (val: any) => {
            const n = safeNumber(val);
            return n !== undefined ? Math.round(n) : undefined;
        };

        const safeString = (val: any, limit?: number) => {
            if (val === undefined) return undefined;
            if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
            let s = typeof val === 'string' ? val.trim() : String(val);
            if (limit && s.length > limit) s = s.substring(0, limit);
            return s;
        };

        const result = await updateUser(userId, {
            username: safeString(username, 50) ?? undefined,
            email: safeString(email, 255) ?? undefined,
            phoneNumber: safeString(phoneNumber, 20) ?? undefined,
            role: typeof role === 'string' ? role : undefined,
            isActive: typeof isActive === 'boolean' ? isActive : undefined,
            sourceConfig:
                sourceConfig !== undefined && sourceConfig !== null ? sourceConfig : undefined,
            identification: safeString(identification, 50) ?? undefined,
            clientType: safeInt(clientType),
            password: password !== undefined ? password.trim() : undefined,
            isCompany: isCompany !== undefined ? Boolean(isCompany) : undefined,
            clientName: safeString(clientName, 255) ?? undefined,
            phoneCountryCode: safeString(phoneCountryCode, 10) ?? undefined, // Truncate to 10 defensively until migration is confirmed
            country: safeString(country, 100) ?? undefined,
            stateOrDepartment: safeString(stateOrDepartment, 100) ?? undefined,
            city: safeString(city, 100) ?? undefined,
            address: safeString(address) ?? undefined, // @db.Text, no limit needed
            marketingSource: safeString(marketingSource, 100) ?? undefined,
            surveyCatPct: safeInt(surveyCatPct),
            surveyKomatsuPct: safeInt(surveyKomatsuPct),
            surveyJohnDeerePct: safeInt(surveyJohnDeerePct),
            allowOrdersWithOverduePortfolio:
                typeof allowOrdersWithOverduePortfolio === 'boolean'
                    ? allowOrdersWithOverduePortfolio
                    : undefined,
            incoterm: safeString(incoterm, 32) ?? undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to update user' },
                { status: 500 }
            );
        }

        if (!result.user) {
            return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
        }

        const updatedUser = result.user;

        // Local user persisted; push client snapshot to Filipo (idempotent upsert).
        let filipoSync: FilipoSyncResult = { ok: false, error: 'skipped' };
        if (updatedUser.role === 'client') {
            const syncHasCredit = hasCredit !== undefined ? Boolean(hasCredit) : false;
            const syncCreditLimit =
                creditLimit !== undefined && creditLimit !== null && creditLimit !== ''
                    ? safeNumber(creditLimit) ?? 0
                    : 0;
            filipoSync = await syncMotorUserToFilipo(
                {
                    userId: updatedUser.id,
                    identification: updatedUser.identification,
                    clientName: updatedUser.clientName,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    phoneNumber: updatedUser.phoneNumber,
                    phoneCountryCode: updatedUser.phoneCountryCode,
                    address: updatedUser.address,
                    city: updatedUser.city,
                    stateOrDepartment: updatedUser.stateOrDepartment,
                    country: updatedUser.country,
                    hasCredit: syncHasCredit,
                    creditLimit: syncCreditLimit,
                },
                filipoCreditOpts,
                'PUT'
            );
            if (filipoSync.ok) {
                if (process.env.NODE_ENV === 'development') {
                    console.info(
                        `[PUT /api/users/${userId}] Filipo PUT ok clientId=${filipoSync.clientId ?? 'n/a'}`
                    );
                }
            } else {
                console.warn(`[PUT /api/users/${userId}] Filipo PUT failed: ${filipoSync.error}`);
            }
        }

        return NextResponse.json({
            success: true,
            data: updatedUser,
            message: 'User updated successfully',
            filipoSync: {
                ok: filipoSync.ok,
                skipped: updatedUser.role !== 'client',
                ...(!filipoSync.ok && filipoSync.error ? { error: filipoSync.error } : {}),
            },
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json(
                { error: 'Invalid user ID' },
                { status: 400 }
            );
        }

        const result = await deleteUser(userId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to delete user' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
