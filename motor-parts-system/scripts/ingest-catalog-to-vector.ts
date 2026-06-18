/**
 * Ingest script: reads extracted catalog text, chunks it, gets OpenAI embeddings,
 * and inserts into Supabase ipmach_knowledge table.
 *
 * Prerequisites:
 * - Run in Supabase SQL Editor: scripts/supabase-ipmach-vector.sql
 * - .env: OPENAI_API_KEY and IPMACH_VECTOR_DATABASE_URL (or DATABASE_URL)
 * - mi-catalogo/extracted-raw.txt (from npm run catalog:extract)
 *
 * Run: npm run catalog:ingest
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const CATALOG_RAW = path.join(process.cwd(), 'mi-catalogo', 'extracted-raw.txt');
const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 120;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 50;

function getConnectionString(): string {
  const url =
    process.env.IPMACH_VECTOR_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set IPMACH_VECTOR_DATABASE_URL or DATABASE_URL in .env (Supabase connection string).'
    );
  }
  return url;
}

function chunkText(text: string): string[] {
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
  if (chunks.length === 0 && text.trim()) chunks.push(text.trim().slice(0, CHUNK_SIZE * 2));
  return chunks;
}

async function getEmbeddings(openai: { embeddings: { create: (opts: { model: string; input: string[] }) => Promise<{ data: { index?: number; embedding: number[] }[] }> } }, texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  const sorted = [...response.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((d) => d.embedding);
}

async function main() {
  console.log('Starting ingest...');

  if (!fs.existsSync(CATALOG_RAW)) {
    console.error('Missing', CATALOG_RAW);
    console.error('Run first: npm run catalog:extract');
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Set OPENAI_API_KEY in .env');
    process.exit(1);
  }

  const rawText = fs.readFileSync(CATALOG_RAW, 'utf8');
  const chunks = chunkText(rawText);
  console.log('Chunks to embed:', chunks.length);

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });
  const pool = new Pool({ connectionString: getConnectionString() });

  let inserted = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await getEmbeddings(openai, batch);
    if (embeddings.length !== batch.length) {
      console.warn('Embedding count mismatch for batch', i);
      continue;
    }
    for (let j = 0; j < batch.length; j++) {
      const content = batch[j];
      const embedding = embeddings[j];
      const vectorStr = '[' + embedding.join(',') + ']';
      await pool.query(
        `INSERT INTO ipmach_knowledge (content, embedding, source, type) VALUES ($1, $2::vector, $3, $4)`,
        [content, vectorStr, 'catalog-2025', 'catalog']
      );
      inserted++;
    }
    console.log('Inserted', inserted, '/', chunks.length);
  }

  await pool.end();
  console.log('Done. Total rows inserted:', inserted);
}

main().catch((err) => {
  console.error('Ingest failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
