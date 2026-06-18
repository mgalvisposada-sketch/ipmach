-- Índices compuestos para optimizar análisis de referencias
-- Migration: add_reference_analytics_indexes
-- Created: 2026-02-12
-- Purpose: Mejorar performance de queries de análisis de conversión y referencias

-- SearchLogs: índice compuesto para búsquedas por referencia en períodos de tiempo
CREATE INDEX IF NOT EXISTS idx_searchlogs_term_timestamp 
  ON "SearchLogs" ("searchTerm", "timestamp" DESC);

-- SearchLogs: índice compuesto para análisis por usuario y referencia
CREATE INDEX IF NOT EXISTS idx_searchlogs_userid_term 
  ON "SearchLogs" ("userId", "searchTerm") 
  WHERE "userId" IS NOT NULL;

-- Orders: índice compuesto para filtros temporales por cliente
CREATE INDEX IF NOT EXISTS idx_orders_created_client 
  ON "Orders" ("createdAt" DESC, "clientId");

-- Orders: índice GIN para búsquedas eficientes en el campo JSON items
-- Esto permite buscar referencias dentro del array JSON de items
CREATE INDEX IF NOT EXISTS idx_orders_items_gin 
  ON "Orders" USING gin (items jsonb_path_ops);

-- Índice adicional para análisis de conversión por estado de orden
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON "Orders" (status, "createdAt" DESC);

-- Comentarios sobre el impacto de estos índices:
-- 1. idx_searchlogs_term_timestamp: Acelera búsqueda de referencias más consultadas en períodos específicos
-- 2. idx_searchlogs_userid_term: Optimiza análisis de clientes por referencia
-- 3. idx_orders_created_client: Mejora filtros de órdenes por fecha y cliente
-- 4. idx_orders_items_gin: Permite búsquedas rápidas de referencias en el JSON de items
-- 5. idx_orders_status_created: Acelera análisis de órdenes por estado en períodos temporales
