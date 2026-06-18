# Propuesta de Reestructuración para Resolver Error "File is not defined"

## Problema Actual

El error `ReferenceError: File is not defined` ocurre porque Playwright está siendo incluido en el bundle del servidor de Next.js, a pesar de usar dynamic imports y webpack externals. Playwright usa APIs del navegador (`File`, `Blob`, etc.) que no existen en Node.js.

## Soluciones Propuestas (de menor a mayor impacto)

### Opción 1: Mejorar Configuración de Next.js (Recomendado Primero)

**Cambios:**
- Agregar `serverComponentsExternalPackages` en `experimental`
- Mejorar configuración de webpack externals
- Asegurar que Playwright solo se carga en runtime

**Ventajas:**
- Cambios mínimos
- No requiere reestructuración
- Mantiene la arquitectura actual

**Desventajas:**
- Puede no funcionar si Next.js aún analiza el código

### Opción 2: Aislar Playwright en un Worker Thread

**Reestructuración:**
```
src/
├── lib/
│   ├── scrapers/
│   │   ├── PlaywrightScraper.ts → Mover a worker
│   │   └── ScraperWorker.ts → Nuevo wrapper para worker
│   └── workers/
│       └── playwright-worker.ts → Worker thread dedicado
└── app/
    └── api/
        └── search/
            └── deep-web/
                └── route.ts → Usa ScraperWorker en lugar de PlaywrightScraper
```

**Ventajas:**
- Aísla completamente Playwright del bundle principal
- No afecta otras partes de la aplicación
- Mantiene el código en el mismo proyecto

**Desventajas:**
- Requiere refactorización del código de scraping
- Puede tener overhead de comunicación entre threads

### Opción 3: Servicio Separado (Microservicio)

**Reestructuración:**
```
proyecto-principal/
├── src/ (sin Playwright)
└── scraper-service/ (nuevo proyecto)
    ├── src/
    │   └── index.ts → API Express/Fastify para scraping
    └── package.json (solo Playwright)
```

**Ventajas:**
- Separación completa de responsabilidades
- Puede escalar independientemente
- No afecta el bundle de Next.js en absoluto

**Desventajas:**
- Requiere dos deployments
- Más complejidad operacional
- Necesita comunicación HTTP entre servicios

### Opción 4: Usar Edge Runtime (No Recomendado)

**Cambios:**
- Mover `/api/search/deep-web` a Edge Runtime
- Playwright no funciona en Edge Runtime (no tiene Chromium)

**Ventajas:**
- Ninguna (no funciona)

**Desventajas:**
- Playwright requiere Node.js completo

## Recomendación: Opción 1 + Opción 2 (Híbrida)

1. **Primero probar Opción 1** con los cambios en `next.config.js`
2. **Si falla, implementar Opción 2** (Worker Thread)

La Opción 2 es la mejor solución intermedia porque:
- No requiere microservicios separados
- Aísla completamente Playwright
- Mantiene todo en un solo proyecto
- Es más fácil de mantener que un microservicio

## Implementación de Opción 2 (Worker Thread)

### Estructura de Archivos:

```
src/
├── lib/
│   └── workers/
│       ├── playwright-worker.ts      # Worker thread con Playwright
│       └── worker-messages.ts        # Tipos de mensajes
└── lib/
    └── scrapers/
        ├── ScraperWorker.ts          # Wrapper que comunica con worker
        └── ScrapeConfig.ts           # Mantener (no cambia)
```

### Flujo:

1. `route.ts` → llama a `ScraperWorker.scrape()`
2. `ScraperWorker` → envía mensaje a `playwright-worker.ts`
3. `playwright-worker.ts` → ejecuta Playwright en worker thread
4. Resultado → se devuelve a `route.ts`

### Ventajas de Worker Thread:

- ✅ Playwright se ejecuta en un thread separado
- ✅ No se incluye en el bundle principal de Next.js
- ✅ No requiere deployment separado
- ✅ Mantiene la arquitectura actual

## Preguntas para Decidir:

1. ¿El error ocurre solo en producción (Railway) o también en desarrollo local?
2. ¿La búsqueda profunda funciona correctamente en desarrollo local?
3. ¿Prefieres mantener todo en un proyecto o está bien separar en microservicio?
4. ¿Cuánto tiempo podemos invertir en la reestructuración?

## Próximos Pasos:

1. **Aplicar cambios de Opción 1** (ya implementados en `next.config.js`)
2. **Probar en Railway**
3. **Si falla, implementar Opción 2** (Worker Thread)

