import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Pool } from 'pg';

function getConnectionString(): string | null {
  return process.env.IPMACH_VECTOR_DATABASE_URL || process.env.DATABASE_URL || null;
}

export type KnowledgeStatusRow = { source: string; type: string; count: string };

export async function GET() {
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
        total: 0,
        bySource: [],
        message: 'Vector DB not configured (IPMACH_VECTOR_DATABASE_URL).',
      });
    }

    const pool = new Pool({ connectionString: conn });
    const [countRes, groupRes] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) as count FROM ipmach_knowledge'),
      pool.query<KnowledgeStatusRow>(
        'SELECT source, type, COUNT(*)::text as count FROM ipmach_knowledge GROUP BY source, type ORDER BY source, type'
      ),
    ]);
    await pool.end();

    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);
    const bySource = groupRes.rows.map((r) => ({
      source: r.source,
      type: r.type,
      count: parseInt(r.count, 10),
    }));

    return NextResponse.json({ total, bySource });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
