import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getAllUsers, createUser } from '@/lib/auth';
import { syncMotorUserToFilipo, type FilipoSyncCreditOptions } from '@/lib/filipo-client-sync';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });
        }

        const result = await getAllUsers();

        if (!result.success) {
            console.error('getAllUsers failed:', result.error);
            return NextResponse.json(
                { error: result.error || 'Failed to fetch users' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.users,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching users:', message, error);
        return NextResponse.json(
            { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? message : undefined },
            { status: 500 }
        );
    }
}

const DEFAULT_CLIENT_TYPE = 17;

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as Record<string, unknown>;
        const {
            username,
            email,
            password,
            phoneNumber,
            role,
            identification,
            clientType,
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
            hasCredit,
            creditLimit,
            incoterm,
        } = body;

        // Validate required fields (body is Record<string, unknown>)
        if (
            typeof username !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            typeof role !== 'string' ||
            username.trim() === '' ||
            email.trim() === '' ||
            password.trim() === ''
        ) {
            return NextResponse.json(
                { error: 'Missing required fields: username, email, password, role' },
                { status: 400 }
            );
        }

        const allowedRoles = new Set(['admin', 'agent', 'client']);
        if (!allowedRoles.has(role)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be admin, agent, or client' },
                { status: 400 }
            );
        }

        let resolvedClientType: number | undefined;
        if (clientType !== undefined && clientType !== null) {
            const clientTypeNum = Number(clientType);
            if (!Number.isFinite(clientTypeNum) || clientTypeNum < 0 || clientTypeNum > 99) {
                return NextResponse.json(
                    { error: 'Invalid clientType. Must be a number between 0 and 99' },
                    { status: 400 }
                );
            }
            resolvedClientType = clientTypeNum;
        } else if (role === 'client') {
            resolvedClientType = DEFAULT_CLIENT_TYPE;
        }

        const hasCreditBool =
            role === 'client' && hasCredit !== undefined ? Boolean(hasCredit) : false;
        const creditLimitNum =
            role === 'client' && creditLimit !== undefined && creditLimit !== null && creditLimit !== ''
                ? Number(creditLimit)
                : 0;

        const result = await createUser({
            username,
            email,
            password,
            phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.trim() || undefined : undefined,
            role,
            identification: typeof identification === 'string' ? identification.trim() || undefined : undefined,
            clientType: resolvedClientType,
            isCompany: isCompany === true ? true : isCompany === false ? false : undefined,
            clientName: typeof clientName === 'string' ? clientName.trim() || undefined : undefined,
            phoneCountryCode: typeof phoneCountryCode === 'string' ? phoneCountryCode.trim() || undefined : undefined,
            country: typeof country === 'string' ? country.trim() || undefined : undefined,
            stateOrDepartment: typeof stateOrDepartment === 'string' ? stateOrDepartment.trim() || undefined : undefined,
            city: typeof city === 'string' ? city.trim() || undefined : undefined,
            address: typeof address === 'string' ? address.trim() || undefined : undefined,
            marketingSource: typeof marketingSource === 'string' ? marketingSource.trim() || undefined : undefined,
            surveyCatPct: surveyCatPct !== undefined && surveyCatPct !== null && surveyCatPct !== '' ? Number(surveyCatPct) : undefined,
            surveyKomatsuPct: surveyKomatsuPct !== undefined && surveyKomatsuPct !== null && surveyKomatsuPct !== '' ? Number(surveyKomatsuPct) : undefined,
            surveyJohnDeerePct: surveyJohnDeerePct !== undefined && surveyJohnDeerePct !== null && surveyJohnDeerePct !== '' ? Number(surveyJohnDeerePct) : undefined,
            incoterm:
                role === 'client' && typeof incoterm === 'string'
                    ? incoterm.trim().slice(0, 32) || null
                    : undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to create user' },
                { status: 500 }
            );
        }

        // Local user created; for clients, upsert the same record in Filipo-Web.
        let filipoSync: { ok: boolean; error?: string } = { ok: false, error: 'skipped' };
        if (role === 'client') {
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
            filipoSync = await syncMotorUserToFilipo(
                {
                    userId: result.user?.id ?? null,
                    identification: typeof identification === 'string' ? identification : undefined,
                    clientName: typeof clientName === 'string' ? clientName.trim() : undefined,
                    username: typeof username === 'string' ? username : undefined,
                    email: typeof email === 'string' ? email : undefined,
                    phoneNumber: typeof phoneNumber === 'string' ? phoneNumber : undefined,
                    phoneCountryCode: typeof phoneCountryCode === 'string' ? phoneCountryCode.trim() : undefined,
                    address: typeof address === 'string' ? address.trim() : undefined,
                    city: typeof city === 'string' ? city.trim() : undefined,
                    stateOrDepartment: typeof stateOrDepartment === 'string' ? stateOrDepartment.trim() : undefined,
                    country: typeof country === 'string' ? country.trim() : undefined,
                    hasCredit: hasCreditBool,
                    creditLimit: Number.isFinite(creditLimitNum) ? creditLimitNum : 0,
                },
                filipoCreditOpts
            );
            if (!filipoSync.ok) {
                console.warn(`[POST /api/users] Filipo sync failed for user "${email}": ${filipoSync.error}`);
            }
        }

        return NextResponse.json({
            success: true,
            data: result.user,
            message: 'User created successfully',
            filipoSync: { ok: filipoSync.ok, error: filipoSync.ok ? undefined : filipoSync.error },
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
