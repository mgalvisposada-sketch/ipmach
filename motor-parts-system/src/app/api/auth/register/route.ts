import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { syncMotorUserToFilipo } from '@/lib/filipo-client-sync';
import { sendClientRegistrationNotification, sendClientRegistrationWelcomeEmail } from '@/lib/email';
import { isNonReceivingEmailDomain } from '@/lib/invalid-email-domains';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 6;
const DEFAULT_CLIENT_TYPE = 17;

function clampPct(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            email,
            password,
            isCompany,
            clientName,
            identification,
            phoneCountryCode,
            phoneNumber,
            country,
            stateOrDepartment,
            city,
            address,
            marketingSource,
            surveyCatPct,
            surveyKomatsuPct,
            surveyJohnDeerePct,
        } = body;

        const emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!emailTrim || !emailTrim.includes('@')) {
            return NextResponse.json(
                { error: 'Correo electrónico válido es obligatorio.' },
                { status: 400 }
            );
        }

        if (isNonReceivingEmailDomain(emailTrim)) {
            return NextResponse.json(
                {
                    error:
                        'Este dominio de correo no puede recibir mensajes. Usa tu cuenta @proshelcorp.com u otro correo (Gmail, Outlook, etc.).',
                },
                { status: 400 }
            );
        }

        const passwordStr = typeof password === 'string' ? password : '';
        if (passwordStr.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json(
                { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
                { status: 400 }
            );
        }

        if (isCompany && (!identification || typeof identification !== 'string' || !identification.trim())) {
            return NextResponse.json(
                { error: 'La identificación fiscal (NIT) es obligatoria para empresas.' },
                { status: 400 }
            );
        }

        const existing = await prisma.users.findUnique({
            where: { email: emailTrim },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json(
                { error: 'Ya existe una cuenta con este correo electrónico.' },
                { status: 409 }
            );
        }

        const hashedPassword = await bcrypt.hash(passwordStr, 12);
        const user = await prisma.users.create({
            data: {
                username: emailTrim,
                email: emailTrim,
                passwordHash: hashedPassword,
                role: 'client',
                clientType: DEFAULT_CLIENT_TYPE,
                isActive: true,
                isCompany: isCompany === true,
                clientName: typeof clientName === 'string' ? clientName.trim() || null : null,
                identification: typeof identification === 'string' ? identification.trim() || null : null,
                phoneCountryCode: typeof phoneCountryCode === 'string' ? phoneCountryCode.trim() || null : null,
                phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.trim() || null : null,
                country: typeof country === 'string' ? country.trim() || null : null,
                stateOrDepartment: typeof stateOrDepartment === 'string' ? stateOrDepartment.trim() || null : null,
                city: typeof city === 'string' ? city.trim() || null : null,
                address: typeof address === 'string' ? address.trim() || null : null,
                marketingSource: typeof marketingSource === 'string' ? marketingSource.trim() || null : null,
                surveyCatPct: clampPct(surveyCatPct),
                surveyKomatsuPct: clampPct(surveyKomatsuPct),
                surveyJohnDeerePct: clampPct(surveyJohnDeerePct),
            },
        });

        // Persist locally first, then upsert the same client in Filipo-Web (external).
        const filipoSync = await syncMotorUserToFilipo({
            userId: user.id,
            identification: user.identification,
            clientName: user.clientName,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            phoneCountryCode: user.phoneCountryCode,
            address: user.address,
            city: user.city,
            stateOrDepartment: user.stateOrDepartment,
            country: user.country,
        });
        if (filipoSync.ok) {
            if (process.env.NODE_ENV === 'development') {
                console.info(
                    `[POST /api/auth/register] Filipo sync ok userId=${user.id} clientId=${filipoSync.clientId ?? 'n/a'} created=${filipoSync.created ?? 'n/a'}`
                );
            }
        } else {
            console.warn(`[POST /api/auth/register] Filipo sync failed for "${emailTrim}": ${filipoSync.error}`);
        }

        const notifyResult = await sendClientRegistrationNotification({
            userId: user.id,
            email: user.email,
            clientName: user.clientName,
            identification: user.identification,
            isCompany: user.isCompany,
            phoneCountryCode: user.phoneCountryCode,
            phoneNumber: user.phoneNumber,
            country: user.country,
            stateOrDepartment: user.stateOrDepartment,
            city: user.city,
            address: user.address,
            marketingSource: user.marketingSource,
            clientType: user.clientType,
            filipoSyncOk: filipoSync.ok,
            filipoSyncError: filipoSync.ok ? null : filipoSync.error ?? null,
        });
        if (
            !notifyResult.ok &&
            notifyResult.error !== 'Notification disabled by configuration'
        ) {
            console.warn(
                `[POST /api/auth/register] Client registration notification: ${notifyResult.error ?? 'unknown'}`
            );
        }

        const welcomeResult = await sendClientRegistrationWelcomeEmail(user.email, user.clientName);
        if (
            !welcomeResult.ok &&
            welcomeResult.error !== 'Notification disabled by configuration' &&
            welcomeResult.error !== 'Recipient domain cannot receive mail'
        ) {
            console.warn(
                `[POST /api/auth/register] Client welcome email: ${welcomeResult.error ?? 'unknown'}`
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Cuenta creada. Ya puedes iniciar sesión.',
            user: {
                id: user.id,
                email: user.email,
                clientName: user.clientName,
            },
            filipoSync: {
                ok: filipoSync.ok,
                ...(process.env.NODE_ENV === 'development' && !filipoSync.ok
                    ? { error: filipoSync.error }
                    : {}),
            },
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'No se pudo crear la cuenta. Intenta de nuevo.' },
            { status: 500 }
        );
    }
}
