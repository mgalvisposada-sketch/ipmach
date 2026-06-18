/**
 * Shared logic for ingesting text into ipmach_knowledge: chunking, embeddings, insert.
 * Used by the CLI ingest script and by the admin API.
 */

import { Pool } from 'pg';
import OpenAI from 'openai';

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 120;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 50;

function getConnectionString(): string {
  const url =
    process.env.IPMACH_VECTOR_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set IPMACH_VECTOR_DATABASE_URL or DATABASE_URL in .env (Supabase connection string).'
    );
  }
  return url;
}

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let current = '';
  for (const p of paragraphs) {
    const next = current ? current + '\n\n' + p.trim() : p.trim();
    if (next.length >= CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      const overlapStart = Math.max(0, current.length - CHUNK_OVERLAP);
      current = current.slice(overlapStart) + '\n\n' + p.trim();
      if (current.length > CHUNK_SIZE) current = p.trim();
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0 && text.trim()) {
    chunks.push(text.trim().slice(0, CHUNK_SIZE * 2));
  }
  return chunks;
}

async function getEmbeddings(
  openai: OpenAI,
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  const sorted = [...response.data].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  return sorted.map((d) => d.embedding);
}

export type IngestResult = { inserted: number; chunks: number };

/**
 * Ingest raw text into ipmach_knowledge: chunk, embed with OpenAI, insert into Supabase.
 * Requires OPENAI_API_KEY and IPMACH_VECTOR_DATABASE_URL (or DATABASE_URL) in env.
 */
export async function runIngest(
  rawText: string,
  source: string,
  type: string
): Promise<IngestResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    return { inserted: 0, chunks: 0 };
  }

  const openai = new OpenAI({ apiKey });
  const pool = new Pool({ connectionString: getConnectionString() });

  let inserted = 0;
  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await getEmbeddings(openai, batch);
      if (embeddings.length !== batch.length) continue;
      for (let j = 0; j < batch.length; j++) {
        const content = batch[j];
        const embedding = embeddings[j];
        const vectorStr = '[' + embedding.join(',') + ']';
        await pool.query(
          `INSERT INTO ipmach_knowledge (content, embedding, source, type) VALUES ($1, $2::vector, $3, $4)`,
          [content, vectorStr, source, type]
        );
        inserted++;
      }
    }
  } finally {
    await pool.end();
  }

  return { inserted, chunks: chunks.length };
}
