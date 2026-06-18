/**
 * Vector search for IPMach assistant: fetch similar chunks from Supabase by query embedding.
 */

import { Pool } from 'pg';

const TOP_K = 35;
const MAX_CONTEXT_CHARS = 48000;

function getConnectionString(): string | null {
  return process.env.IPMACH_VECTOR_DATABASE_URL || process.env.DATABASE_URL || null;
}

export async function getSimilarChunks(
  queryEmbedding: number[],
  sourceFilter?: string
): Promise<{ content: string; source: string; type: string }[]> {
  const conn = getConnectionString();
  if (!conn || queryEmbedding.length !== 1536) return [];

  const vectorStr = '[' + queryEmbedding.join(',') + ']';
  const pool = new Pool({ connectionString: conn });

  try {
    const whereClause = sourceFilter ? 'WHERE source = $3' : '';
    const params: (string | number)[] = sourceFilter 
      ? [vectorStr, TOP_K, sourceFilter] 
      : [vectorStr, TOP_K];
    
    const res = await pool.query<{ content: string; source: string; type: string }>(
      `SELECT content, source, type FROM ipmach_knowledge 
       ${whereClause}
       ORDER BY embedding <=> $1::vector 
       LIMIT $2`,
      params
    );
    await pool.end();
    let total = 0;
    const out: { content: string; source: string; type: string }[] = [];
    for (const row of res.rows) {
      if (total + row.content.length > MAX_CONTEXT_CHARS) break;
      out.push(row);
      total += row.content.length;
    }
    return out;
  } catch {
    await pool.end();
    return [];
  }
}

export async function getKeywordChunks(
  keywords: string[],
  limit: number = 15
): Promise<{ content: string; source: string; type: string }[]> {
  const conn = getConnectionString();
  if (!conn || keywords.length === 0) return [];

  const pool = new Pool({ connectionString: conn });
  try {
    // Build ILIKE conditions for each keyword
    const conditions = keywords.map((_, idx) => `content ILIKE $${idx + 1}`).join(' OR ');
    const params = [...keywords.map(k => `%${k}%`), limit];

    const res = await pool.query<{ content: string; source: string; type: string }>(
      `SELECT content, source, type FROM ipmach_knowledge 
       WHERE ${conditions} 
       LIMIT $${keywords.length + 1}`,
      params
    );
    await pool.end();
    return res.rows;
  } catch (err) {
    console.error('[ipmach-vector] getKeywordChunks error:', err);
    await pool.end();
    return [];
  }
}

export function hasVectorConfig(): boolean {
  return !!getConnectionString();
}
