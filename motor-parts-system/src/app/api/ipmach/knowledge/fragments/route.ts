import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Pool } from 'pg';

function getConnectionString(): string | null {
  return process.env.IPMACH_VECTOR_DATABASE_URL || process.env.DATABASE_URL || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conn = getConnectionString();
    if (!conn) {
      return NextResponse.json({
        fragments: [],
        total: 0,
        message: 'Vector DB not configured',
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || '';
    const type = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const pool = new Pool({ connectionString: conn });

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`content ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }
    if (type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ipmach_knowledge ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    // Get fragments with pagination
    const fragmentsRes = await pool.query<{
      id: number;
      content: string;
      source: string;
      type: string;
      created_at: string;
    }>(
      `SELECT id, content, source, type, created_at 
       FROM ipmach_knowledge 
       ${whereClause}
       ORDER BY created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    await pool.end();

    return NextResponse.json({
      fragments: fragmentsRes.rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[knowledge/fragments GET]', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch fragments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conn = getConnectionString();
    if (!conn) {
      return NextResponse.json({ error: 'Vector DB not configured' }, { status: 400 });
    }

    const body = await request.json();
    const { id, source, type } = body;

    const pool = new Pool({ connectionString: conn });

    if (id) {
      // Delete specific fragment by ID
      await pool.query('DELETE FROM ipmach_knowledge WHERE id = $1', [id]);
      await pool.end();
      return NextResponse.json({ message: 'Fragment deleted', deleted: 1 });
    }

    if (source && type) {
      // Delete all fragments from a source/type combination
      const result = await pool.query(
        'DELETE FROM ipmach_knowledge WHERE source = $1 AND type = $2',
        [source, type]
      );
      await pool.end();
      return NextResponse.json({
        message: `Deleted ${result.rowCount} fragments from ${source}/${type}`,
        deleted: result.rowCount || 0,
      });
    }

    await pool.end();
    return NextResponse.json({ error: 'Provide id or source+type to delete' }, { status: 400 });
  } catch (err) {
    console.error('[knowledge/fragments DELETE]', err);
    const message = err instanceof Error ? err.message : 'Failed to delete';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
