/**
 * Check that the PDF (and any other content) is indexed in the vector knowledge base.
 *
 * Run: npm run catalog:vector-status
 *
 * Requires: IPMACH_VECTOR_DATABASE_URL or DATABASE_URL in .env (Supabase connection).
 */

import 'dotenv/config';
import { Pool } from 'pg';

function getConnectionString(): string | null {
  return process.env.IPMACH_VECTOR_DATABASE_URL || process.env.DATABASE_URL || null;
}

async function main() {
  const conn = getConnectionString();
  if (!conn) {
    console.log('No vector DB configured. Set IPMACH_VECTOR_DATABASE_URL or DATABASE_URL in .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: conn });

  try {
    const countRes = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM ipmach_knowledge'
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);
    console.log('\n  Base de conocimiento vectorial (ipmach_knowledge)');
    console.log('  ' + '─'.repeat(50));
    console.log('  Total de fragmentos indexados:', total);

    if (total === 0) {
      console.log('\n  El PDF aún no está indexado. Ejecuta: npm run catalog:ingest');
      await pool.end();
      process.exit(1);
    }

    const bySource = await pool.query<{ source: string; type: string; count: string }>(
      'SELECT source, type, COUNT(*) as count FROM ipmach_knowledge GROUP BY source, type ORDER BY count DESC'
    );
    console.log('\n  Por origen:');
    for (const row of bySource.rows) {
      console.log('    -', row.source, '|', row.type, '→', row.count, 'fragmentos');
    }

    const sampleRes = await pool.query<{ id: string; source: string; type: string; preview: string }>(
      `SELECT id, source, type, LEFT(content, 100) || '...' as preview 
       FROM ipmach_knowledge 
       ORDER BY id 
       LIMIT 3`
    );
    console.log('\n  Muestra de contenido (primeros 3):');
    for (const row of sampleRes.rows) {
      console.log('    [id', row.id + ']', row.source + '/' + row.type + ':', row.preview);
    }

    console.log('\n  Estado: indexación correcta. El asistente puede usar la base vectorial.\n');
  } catch (e) {
    console.error('Error al conectar o consultar la base:', e instanceof Error ? e.message : e);
    console.error('Revisa que la tabla ipmach_knowledge exista (ejecuta scripts/supabase-ipmach-vector.sql en Supabase).');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
