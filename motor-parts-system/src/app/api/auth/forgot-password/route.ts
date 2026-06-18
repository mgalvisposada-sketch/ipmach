import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const TOKEN_EXPIRY_HOURS = 1;
const MIN_EMAIL_LENGTH = 5;

/**
 * Request a password reset link by email.
 * Always returns the same generic message to avoid user enumeration.
 *
 * POST body: { email: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rawEmail = typeof body?.email === 'string' ? body.email.trim() : '';

        if (!rawEmail || rawEmail.length < MIN_EMAIL_LENGTH) {
            return NextResponse.json(
                { message: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña en unos minutos.' },
                { status: 200 }
            );
        }

        const email = rawEmail.toLowerCase();
        const user = await prisma.users.findUnique({
            where: { email },
            select: { id: true, isActive: true },
        });

        if (user && user.isActive) {
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

            await prisma.users.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: tokenHash,
                    passwordResetTokenExpiresAt: expiresAt,
                },
            });

            await sendPasswordResetEmail(email, token);
        }

        return NextResponse.json({
            message: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña en unos minutos.',
        }, { status: 200 });
    } catch (error: unknown) {
        console.error('Forgot password request error:', error);
        return NextResponse.json(
            { message: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña en unos minutos.' },
            { status: 200 }
        );
    }
}
