-- Run this in Supabase SQL Editor (Step 2 of the guide).
-- 1. Enables the pgvector extension.
-- 2. Creates the table for the IPMach assistant knowledge base (catalog + company info).

-- Enable pgvector (required for vector type)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: one row per text chunk. embedding = vector for similarity search.
-- source: e.g. 'catalog-2025', 'company-info'
-- type: e.g. 'catalog', 'hours', 'policies', 'faq'
CREATE TABLE IF NOT EXISTS ipmach_knowledge (
  id         BIGSERIAL PRIMARY KEY,
  content    TEXT NOT NULL,
  embedding  vector(1536) NOT NULL,
  source     VARCHAR(100) NOT NULL DEFAULT 'catalog',
  type       VARCHAR(50) NOT NULL DEFAULT 'catalog',
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for similarity search (lists=1 works with any number of rows; increase after you have more data)
CREATE INDEX IF NOT EXISTS ipmach_knowledge_embedding_idx
  ON ipmach_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- Optional: index for filtering by source/type later
CREATE INDEX IF NOT EXISTS ipmach_knowledge_source_type_idx
  ON ipmach_knowledge (source, type);

-- Success message (you can ignore this in the output)
DO $$
BEGIN
  RAISE NOTICE 'ipmach_knowledge table and index created. You can run the ingest script.';
END $$;
