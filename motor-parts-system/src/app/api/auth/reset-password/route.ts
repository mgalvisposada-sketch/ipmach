import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 6;
const GENERIC_ERROR_MESSAGE = 'Enlace inválido o expirado. Solicita uno nuevo desde Recuperar contraseña.';

/**
 * Reset password using the token received by email.
 * POST body: { token: string, newPassword: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const token = typeof body?.token === 'string' ? body.token.trim() : '';
        const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : '';

        if (!token) {
            return NextResponse.json(
                { error: GENERIC_ERROR_MESSAGE },
                { status: 400 }
            );
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres.' },
                { status: 400 }
            );
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const now = new Date();

        const user = await prisma.users.findFirst({
            where: {
                passwordResetToken: tokenHash,
                passwordResetTokenExpiresAt: { gt: now },
            },
            select: { id: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: GENERIC_ERROR_MESSAGE },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.users.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                passwordResetToken: null,
                passwordResetTokenExpiresAt: null,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.',
        }, { status: 200 });
    } catch (error: unknown) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: GENERIC_ERROR_MESSAGE },
            { status: 500 }
        );
    }
}
