# Módulo de Análisis de Referencias y Conversión

## Descripción General

El Módulo de Análisis de Referencias es un sistema avanzado de inteligencia de negocio que permite a los administradores identificar productos candidatos a mantener en stock propio, basándose en análisis de búsquedas, tasas de conversión, comportamiento de clientes y predicciones de demanda.

## Características Principales

### 1. Análisis de Conversión
- Cálculo automático de tasas de conversión (búsquedas → órdenes)
- Identificación de referencias de alto valor
- Análisis de revenue por referencia
- Métricas de clientes únicos interesados

### 2. Análisis de Tendencias
- Detección automática de tendencias (creciente, decreciente, estable)
- Regresión lineal para proyecciones
- Coeficiente de confianza (R²)
- Indicadores visuales de dirección

### 3. Análisis de Estacionalidad
- Agrupación por períodos (trimestral, mensual, semanal)
- Detección automática de patrones estacionales
- Identificación de períodos pico y bajos
- Proyecciones para el próximo trimestre

### 4. Sistema de Recomendaciones
- Algoritmo de scoring ponderado (0-100)
- Categorización por prioridad (alta, media, baja)
- Criterios configurables:
  - Conversión: 40% del peso
  - Volumen de búsquedas: 30%
  - Tendencia: 20%
  - Revenue: 10%

### 5. Análisis de Clientes
- Detalle de clientes por referencia
- Cálculo de tiempo hasta conversión
- Identificación de clientes de alto interés
- Referencias relacionadas buscadas
- Frecuencia de búsqueda promedio

## Arquitectura

### Backend

#### APIs Principales

**`/api/analytics/references/conversion`**
- Método: GET
- Autenticación: Admin only
- Parámetros:
  - `startDate`: fecha inicio (ISO)
  - `endDate`: fecha fin (ISO)
  - `limit`: cantidad de resultados (default: 50)
  - `sortBy`: criterio de ordenamiento (searches|conversion|revenue|orders)
  - `minSearches`: filtro mínimo de búsquedas (default: 1)
- Retorna: Lista de referencias con métricas completas

**`/api/analytics/references/[reference]/clients`**
- Método: GET
- Autenticación: Admin only
- Retorna: Detalle de clientes que buscaron la referencia

**`/api/analytics/references/[reference]/seasonality`**
- Método: GET
- Autenticación: Admin only
- Parámetros:
  - `periods`: número de períodos históricos (default: 12)
- Retorna: Análisis de estacionalidad y predicciones

#### Librerías de Análisis

**`src/lib/analytics/conversion-calculator.ts`**
- `calculateConversionForReference()`: Calcula métricas para una referencia
- `calculateConversionForMultipleReferences()`: Procesamiento en lote
- `sortMetrics()`: Ordenamiento por criterios
- `calculatePeriodStats()`: Estadísticas agregadas

**`src/lib/analytics/trend-detector.ts`**
- `detectTrend()`: Análisis de tendencia con regresión lineal
- `comparePeriods()`: Comparación entre períodos
- `calculateVolatility()`: Cálculo de volatilidad

**`src/lib/analytics/seasonality-analyzer.ts`**
- `analyzeSeasonality()`: Análisis completo de estacionalidad
- Agrupación automática por trimestre/mes/semana
- Detección de patrones estacionales
- Generación de recomendaciones

**`src/lib/analytics/stock-recommender.ts`**
- `evaluateStockRecommendation()`: Evaluación de candidatos
- `generateBulkRecommendations()`: Procesamiento masivo
- `groupByPriority()`: Agrupación por prioridad
- `calculateEstimatedInvestment()`: Estimación de inversión

### Frontend

#### Página Principal
**`src/app/(dashboard)/analytics/references/page.tsx`**
- Selector de período (trimestre, 6 meses, año, personalizado)
- Cards de métricas generales
- Tabla interactiva con ordenamiento
- Filtros por búsquedas mínimas
- Búsqueda en tiempo real

#### Componentes de Visualización

**`ReferenceConversionChart`**
- Scatter plot: Búsquedas vs Conversión
- Bar chart: Top 20 referencias por revenue
- Bar chart: Top 15 por conversión
- Colores por prioridad de recomendación

**`ClientDetailModal`**
- Resumen de métricas de clientes
- Tabla detallada de clientes
- Insights de alto interés
- Referencias relacionadas

**`SeasonalityAnalysisModal`**
- Gráficos de línea: evolución temporal
- Gráficos de barra: comparación por período
- Predicciones para próximo trimestre
- Recomendaciones textuales

## Base de Datos

### Índices Optimizados

La migración `20260212_add_reference_analytics_indexes.sql` agrega:

```sql
-- Búsquedas por referencia en períodos
idx_searchlogs_term_timestamp ON SearchLogs (searchTerm, timestamp DESC)

-- Análisis por usuario y referencia
idx_searchlogs_userid_term ON SearchLogs (userId, searchTerm)

-- Filtros temporales por cliente
idx_orders_created_client ON Orders (createdAt DESC, clientId)

-- Búsquedas en JSON de items
idx_orders_items_gin ON Orders USING gin (items jsonb_path_ops)

-- Análisis por estado y período
idx_orders_status_created ON Orders (status, createdAt DESC)
```

### Tablas Principales

- **SearchLogs**: Registro de todas las búsquedas
- **Orders**: Órdenes de compra con items en JSON
- **Users**: Información de clientes

## Seguridad

### Control de Acceso
- Middleware protege ruta `/analytics/*` (admin only)
- APIs verifican rol de administrador
- Redirección automática a `/dashboard` para no autorizados

### Rate Limiting
- Recomendado: implementar rate limiting en APIs de analytics
- Sugerencia: 100 requests por minuto por usuario admin

## Performance

### Optimizaciones Implementadas

1. **Índices Compuestos**: Queries optimizadas con índices específicos
2. **Paginación**: Límite de 100 referencias en tabla
3. **Procesamiento Paralelo**: Promise.allSettled en búsquedas
4. **JSON Parsing**: Cache interno de items parseados

### Optimizaciones Recomendadas

1. **Caché Redis**: 
   - TTL: 15 minutos para resultados de análisis
   - Key pattern: `analytics:references:{startDate}:{endDate}:{sortBy}`
   
2. **Query Optimization**:
   - Considerar materializar vista de conversión
   - Agregaciones pre-calculadas en horarios de baja demanda

3. **Lazy Loading**:
   - Cargar modales solo cuando se abren
   - Paginación en tabla de clientes

## Uso

### Para Administradores

1. **Acceder al Módulo**:
   - Dashboard → Card "Análisis de Referencias" → "Ver Análisis Completo"
   - O directamente: `/analytics/references`

2. **Seleccionar Período**:
   - Presets: Último trimestre, 6 meses, año
   - Personalizado: seleccionar fechas específicas

3. **Analizar Referencias**:
   - Ordenar por: búsquedas, conversión, revenue, órdenes
   - Filtrar por búsquedas mínimas
   - Ver badges de prioridad para stock

4. **Detalle de Clientes**:
   - Click en "X clientes" en tabla
   - Ver quiénes buscan y quiénes convierten
   - Identificar clientes de alto interés

5. **Análisis de Estacionalidad**:
   - Click en ícono de tendencia
   - Ver histórico trimestral/mensual/semanal
   - Revisar predicciones y recomendaciones

## Algoritmos

### Cálculo de Conversión
```typescript
conversionRate = (totalOrders / totalSearches) * 100
```

### Regresión Lineal (Tendencia)
```typescript
y = mx + b
donde:
  m = pendiente (slope)
  b = intercepto Y
  R² = coeficiente de determinación (confianza)
```

### Scoring de Recomendación
```typescript
score = (conversionScore * 0.40) + 
        (volumeScore * 0.30) + 
        (trendScore * 0.20) + 
        (revenueScore * 0.10)

Recomendado si score >= 70
```

### Detección de Estacionalidad
```typescript
Estacional si:
  variationCoefficient > 20%
donde:
  variationCoefficient = (stdDev / mean) * 100
```

## Extensibilidad Futura

### Características Planeadas

1. **Machine Learning**:
   - Prophet para series temporales
   - Clustering de referencias similares
   - Predicciones de demanda avanzadas

2. **Alertas Automáticas**:
   - Email cuando referencia supera umbrales
   - Notificaciones de cambios de tendencia
   - Recordatorios de reabastecimiento

3. **Exports**:
   - CSV/Excel de análisis completo
   - PDFs de reportes ejecutivos
   - Integración con BI tools

4. **Integración con Inventario**:
   - Conexión directa con sistema de compras
   - Órdenes de compra sugeridas
   - Tracking de ROI real vs proyectado

5. **Análisis Comparativo**:
   - Benchmarking contra períodos anteriores
   - Comparación año sobre año
   - Análisis de competidores (si disponible)

## Troubleshooting

### Problemas Comunes

**1. Datos no aparecen**
- Verificar que existan búsquedas y órdenes en el período
- Confirmar que `minSearches` no es muy alto
- Revisar logs del servidor para errores de API

**2. Performance lenta**
- Reducir rango de fechas
- Aumentar `minSearches` para filtrar más
- Verificar índices de BD aplicados
- Considerar implementar caché

**3. Conversión parece incorrecta**
- Verificar que órdenes canceladas están excluidas
- Confirmar que referencias en JSON coinciden (case-insensitive)
- Revisar lógica de normalización en `conversion-calculator.ts`

**4. Gráficos no se visualizan**
- Verificar que Recharts está instalado
- Revisar consola del navegador para errores
- Confirmar que datos tienen formato correcto

## Mantenimiento

### Monitoreo Recomendado

1. **Queries Lentas**:
   - Monitorear tiempo de respuesta de APIs
   - Alert si > 5 segundos

2. **Uso de Memoria**:
   - Procesar máximo 10,000 referencias
   - Implementar límites adicionales si necesario

3. **Calidad de Datos**:
   - Validar que SearchLogs se registran correctamente
   - Verificar integridad de Orders.items JSON

### Actualizaciones

Para actualizar el módulo:

1. Modificar librerías en `src/lib/analytics/`
2. Actualizar APIs según necesidad
3. Ajustar componentes frontend
4. Ejecutar `npm run build` para verificar
5. Probar en staging antes de producción

## Créditos

**Versión**: 1.0.0
**Fecha**: Febrero 2026
**Frameworks**: Next.js 15, React 19, Recharts, Prisma
**Base de Datos**: PostgreSQL con pgvector

---

Para soporte o preguntas, consultar la documentación técnica del proyecto principal.
