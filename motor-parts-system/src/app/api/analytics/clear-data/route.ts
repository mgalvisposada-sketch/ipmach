import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

/**
 * POST /api/analytics/clear-data
 * Limpia todos los datos históricos de análisis
 * Requiere autenticación de admin y verificación de contraseña
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only admins can clear data
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores pueden limpiar datos.' },
        { status: 403 }
      );
    }

    // Get password from request body
    const body = await request.json();
    let { password, confirmText } = body;

    // Trim password to remove accidental spaces
    password = password?.trim();
    confirmText = confirmText?.trim();

    console.log('[CLEAR DATA] Validando parámetros...');
    console.log('[CLEAR DATA] Password recibido (length):', password?.length);
    console.log('[CLEAR DATA] Password primeros 3 chars:', password?.substring(0, 3));
    console.log('[CLEAR DATA] confirmText recibido:', confirmText);

    if (!password) {
      return NextResponse.json(
        { error: 'Se requiere contraseña para confirmar la acción' },
        { status: 400 }
      );
    }

    // Verify confirmation text
    if (confirmText !== 'BORRAR DATOS') {
      return NextResponse.json(
        { error: 'Texto de confirmación incorrecto' },
        { status: 400 }
      );
    }

    // Get user from database to verify password
    const userId = parseInt(session.user.id);
    console.log('[CLEAR DATA] Buscando usuario ID:', userId);
    
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        passwordHash: true,
      },
    });

    if (!user) {
      console.error('[CLEAR DATA] Usuario no encontrado en BD');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    console.log('[CLEAR DATA] Usuario encontrado:', user.username);
    console.log('[CLEAR DATA] Password hash existe:', !!user.passwordHash);
    console.log('[CLEAR DATA] Password hash length:', user.passwordHash?.length);

    // Verify password
    console.log('[CLEAR DATA] Verificando contraseña con bcrypt...');
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('[CLEAR DATA] Resultado de bcrypt.compare:', passwordMatch);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 403 } // 403 instead of 401 to avoid session logout
      );
    }

    // Password verified - proceed with data deletion
    const timestamp = new Date().toISOString();
    console.log(`[CLEAR DATA - ${timestamp}] Admin ${user.username} (ID: ${user.id}) iniciando limpieza de datos...`);

    try {
      // Count records before deletion
      console.log('[CLEAR DATA] Contando registros antes de eliminar...');
      const searchLogsCount = await prisma.searchLogs.count();
      const userSessionsCount = await prisma.userSessions.count();
      console.log(`[CLEAR DATA] Encontrados: ${searchLogsCount} SearchLogs, ${userSessionsCount} UserSessions`);

      // Delete all SearchLogs
      console.log('[CLEAR DATA] Eliminando SearchLogs...');
      const deletedSearchLogs = await prisma.searchLogs.deleteMany({});
      console.log(`[CLEAR DATA] SearchLogs eliminados: ${deletedSearchLogs.count}`);

      // Delete all UserSessions
      console.log('[CLEAR DATA] Eliminando UserSessions...');
      const deletedUserSessions = await prisma.userSessions.deleteMany({});
      console.log(`[CLEAR DATA] UserSessions eliminados: ${deletedUserSessions.count}`);

      console.log(`[CLEAR DATA] Limpieza completada exitosamente`);
      console.log(`  - SearchLogs: ${deletedSearchLogs.count} registros eliminados`);
      console.log(`  - UserSessions: ${deletedUserSessions.count} registros eliminados`);

      const responseData = {
        success: true,
        message: 'Datos históricos eliminados exitosamente',
        deleted: {
          searchLogs: deletedSearchLogs.count,
          userSessions: deletedUserSessions.count,
        },
        previousCounts: {
          searchLogs: searchLogsCount,
          userSessions: userSessionsCount,
        },
        clearedBy: {
          userId: user.id,
          username: user.username,
          timestamp,
        },
      };

      console.log('[CLEAR DATA] Enviando respuesta exitosa:', responseData);
      return NextResponse.json(responseData);
    } catch (deleteError) {
      console.error('[CLEAR DATA] Error durante la eliminación:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar datos: ' + (deleteError as Error).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[CLEAR DATA] Error general:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: 'Error al limpiar datos históricos: ' + errorMessage },
      { status: 500 }
    );
  } finally {
    try {
      await prisma.$disconnect();
      console.log('[CLEAR DATA] Conexión a BD cerrada');
    } catch (disconnectError) {
      console.error('[CLEAR DATA] Error al cerrar conexión:', disconnectError);
    }
  }
}

/**
 * GET /api/analytics/clear-data
 * Retorna información sobre los datos que serían eliminados
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Only admins can view this information
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      );
    }

    // Count records that would be deleted
    const searchLogsCount = await prisma.searchLogs.count();
    const userSessionsCount = await prisma.userSessions.count();

    // Get date range of data
    const oldestSearch = await prisma.searchLogs.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });

    const newestSearch = await prisma.searchLogs.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        searchLogs: {
          count: searchLogsCount,
          oldestRecord: oldestSearch?.timestamp || null,
          newestRecord: newestSearch?.timestamp || null,
        },
        userSessions: {
          count: userSessionsCount,
        },
        warning: 'Esta acción es irreversible y eliminará todos los datos históricos de búsquedas y sesiones.',
      },
    });
  } catch (error) {
    console.error('Error getting clear data info:', error);
    return NextResponse.json(
      { error: 'Error al obtener información' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
