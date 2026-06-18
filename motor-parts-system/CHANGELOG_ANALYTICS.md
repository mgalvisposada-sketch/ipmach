# Changelog - Módulo de Análisis de Referencias

## [1.1.1] - 2026-02-12

### 🐛 Correcciones Críticas

#### Fix: Logout Involuntario al Limpiar Datos
- **Problema**: Usuario era deslogueado al ingresar contraseña incorrecta en limpieza de datos
- **Causa**: API devolvía 401 que `apiCall()` interpretaba como sesión expirada
- **Solución**: 
  - Cambio de código de error de 401 → 403 para contraseña incorrecta
  - Uso directo de `fetch()` en lugar de `apiCall()` en el modal
  - Logging mejorado para debugging
- **Impacto**: Alto - Funcionalidad crítica ahora funciona correctamente
- **Documentación**: Ver `docs/CLEAR_DATA_BUGFIX.md`

### 🔧 Mejoras

#### Logging Mejorado
- Logs detallados en frontend (consola del navegador)
- Logs detallados en backend (terminal del servidor)
- Timestamps en cada operación
- Información de cantidad de registros antes y después

#### Manejo de Errores
- Try-catch mejorado en eliminación de datos
- Mensajes de error más descriptivos
- Mejor feedback visual al usuario

## [1.1.0] - 2026-02-12

### ✅ Agregado

#### Funcionalidad de Limpieza de Datos Históricos
- **Endpoint API**: `/api/analytics/clear-data`
  - POST: Elimina datos históricos con verificación de contraseña
  - GET: Muestra información sobre datos a eliminar
- **Componente**: `ClearDataModal`
  - Modal de advertencia con múltiples confirmaciones
  - Verificación de contraseña del administrador
  - Confirmación textual ("BORRAR DATOS")
  - Feedback visual del proceso
- **Botón**: "Limpiar Datos" en página de analytics
  - Solo visible para administradores
  - Estilo distintivo (rojo) para acción crítica

#### Seguridad
- Verificación de contraseña con bcrypt
- Confirmación doble antes de eliminar
- Logging de auditoría (quién, cuándo, cuánto)
- Validación de rol de administrador
- Mensajes de error descriptivos

#### Documentación
- `VALIDATION_REPORT.md`: Reporte completo de validación de cálculos
- `DATA_CLEANUP_GUIDE.md`: Guía detallada de uso de limpieza
- `CHANGELOG_ANALYTICS.md`: Este archivo

### 🔧 Mejorado

#### Validación de Datos
- Revisión exhaustiva de fórmulas de conversión ✅
- Validación de cálculo de revenue ✅
- Verificación de normalización de referencias ✅
- Confirmación de detección de tendencias ✅

### 📊 Estado de Validación

| Componente | Estado | Notas |
|------------|--------|-------|
| Cálculo de Conversión | ✅ CORRECTO | Formula: (órdenes / búsquedas) * 100 |
| Cálculo de Revenue | ✅ CORRECTO | Suma de totalPrice por referencia |
| Normalización de Referencias | ✅ CORRECTO | Case-insensitive, sin espacios |
| Clientes Únicos | ✅ CORRECTO | Usa Set para garantizar unicidad |
| Detección de Tendencias | ✅ CORRECTO | Regresión lineal con R² |
| Detección de Estacionalidad | ✅ ACEPTABLE | Umbral del 20% es configurable |
| Parsing de JSON Items | ✅ FUNCIONAL | Maneja arrays y strings |
| Queries de Base de Datos | ✅ CORRECTO | Índices optimizados aplicados |

### ⚠️ Consideraciones Identificadas

1. **Conversión >100%**: Técnicamente posible si múltiples órdenes por búsqueda
   - **Impacto**: Bajo (caso edge raro)
   - **Solución**: Documentado en VALIDATION_REPORT.md
   - **Estado**: Aceptable por ahora

2. **Umbrales Hardcoded**: Valores como 20% estacionalidad son fijos
   - **Impacto**: Medio (puede requerir ajustes por negocio)
   - **Solución Futura**: Tabla de configuración
   - **Estado**: Funcional pero mejorable

3. **JSON en Orders.items**: Campo JSON no normalizado
   - **Impacto**: Bajo (performance aceptable)
   - **Solución Futura**: Tabla OrderItems normalizada
   - **Estado**: Funcional pero no óptimo

### 🐛 Correcciones

- **Build Errors**: Corregidos imports de heroicons (TrendingUpIcon → ArrowTrendingUpIcon)
- **Type Errors**: Corregidos tipos de parámetros en Next.js 15 (params async)
- **Decimal Conversion**: Agregada conversión de Decimal a Number en queries
- **Lint Errors**: Corregidos caracteres escapados en JSX

### 🚀 Mejoras de Performance

- Índices optimizados en SearchLogs (term + timestamp)
- Índice GIN en Orders.items para búsqueda JSON
- Queries con filtros apropiados (excluir canceladas)

## [1.0.0] - 2026-02-12

### Lanzamiento Inicial

#### Backend
- 4 librerías de análisis implementadas
- 3 endpoints API creados
- Migración de índices de base de datos
- Sistema de scoring ponderado

#### Frontend
- Página principal de analytics
- 3 componentes de visualización con Recharts
- 2 modales de detalle
- Integración con dashboard

#### Características
- Análisis de conversión búsquedas → órdenes
- Detección de tendencias con regresión lineal
- Análisis de estacionalidad trimestral/mensual/semanal
- Sistema de recomendaciones para stock propio
- Análisis detallado de clientes

---

## Próximos Pasos Planeados

### Versión 1.2.0 (Planificada)
- [ ] Exportación de análisis a CSV/Excel
- [ ] Configuración de umbrales personalizables
- [ ] Métricas de "conversión por cliente único"
- [ ] Límite máximo de conversión al 100%

### Versión 1.3.0 (Planificada)
- [ ] Sistema de alertas por email
- [ ] Limpieza selectiva (por fecha, por cliente)
- [ ] Programación de limpieza automática
- [ ] Dashboard de auditoría de limpiezas

### Versión 2.0.0 (Visión)
- [ ] Machine Learning con Prophet
- [ ] Clustering de referencias similares
- [ ] Normalización de tabla OrderItems
- [ ] Sistema de papelera (undo de limpieza)
- [ ] Predicciones avanzadas de demanda

---

**Mantenido por**: Equipo de Desarrollo  
**Última Actualización**: 2026-02-12
