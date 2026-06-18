import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

/**
 * POST /api/analytics/test-password
 * Endpoint de DEBUG para probar verificación de contraseña
 * DEBE ELIMINARSE EN PRODUCCIÓN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admins' }, { status: 403 });
    }

    const body = await request.json();
    let { password } = body;
    
    password = password?.trim();

    const userId = parseInt(session.user.id);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    console.log('=== TEST PASSWORD DEBUG ===');
    console.log('User ID:', user.id);
    console.log('Username:', user.username);
    console.log('Password length received:', password?.length);
    console.log('Password first 3 chars:', password?.substring(0, 3));
    console.log('Password last 3 chars:', password?.substring(password.length - 3));
    console.log('Password hash exists:', !!user.passwordHash);
    console.log('Password hash length:', user.passwordHash?.length);
    console.log('Password hash algorithm:', user.passwordHash?.substring(0, 7)); // Should be $2a$ or $2b$

    // Test password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('bcrypt.compare result:', passwordMatch);
    console.log('=== END DEBUG ===');

    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        username: user.username,
        passwordLength: password?.length,
        hashLength: user.passwordHash?.length,
        hashAlgorithm: user.passwordHash?.substring(0, 7),
        passwordMatch,
      },
    });
  } catch (error) {
    console.error('Error in test-password:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
