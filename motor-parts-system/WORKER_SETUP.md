# Worker Thread Setup - Solución al Error "File is not defined"

## Problema Resuelto

El error `ReferenceError: File is not defined` ocurría porque Playwright se estaba incluyendo en el bundle de Next.js durante el build, causando que APIs del navegador se ejecutaran en Node.js.

## Solución Implementada: Worker Thread

Playwright ahora se ejecuta en un **worker thread separado**, completamente aislado del bundle principal de Next.js.

## Archivos Creados

1. **`src/lib/workers/playwright-worker.ts`** - Worker thread con toda la lógica de Playwright
2. **`src/lib/workers/worker-messages.ts`** - Tipos para comunicación entre threads
3. **`src/lib/scrapers/ScraperWorker.ts`** - Wrapper que comunica con el worker
4. **`scripts/build-worker.js`** - Script para compilar el worker antes del build

## Cambios en Configuración

### `package.json`
- Agregado script `build:worker` para compilar el worker
- Modificado `build` para ejecutar `build:worker` primero
- Agregadas dependencias: `esbuild`, `ignore-loader`

### `next.config.js`
- Agregada regla para ignorar archivos del worker
- Mejorada exclusión de Playwright del bundle

### `Dockerfile`
- Actualizado para compilar el worker antes del build de Next.js
- Copia el worker compilado al contenedor

## Flujo de Build

1. **`npm run build:worker`** - Compila el worker TypeScript a JavaScript usando esbuild
2. **`npm run build`** - Build de Next.js (ignora el worker porque ya está compilado)
3. **Producción** - El worker compilado se copia al contenedor

## Cómo Funciona

```
API Route (route.ts)
    ↓
ScraperWorker (wrapper)
    ↓
Worker Thread (playwright-worker.js)
    ↓
Playwright (aislado, no en bundle)
```

## Instalación

```bash
# Instalar dependencias
npm install

# Compilar el worker (se hace automáticamente en build)
npm run build:worker

# Build completo
npm run build
```

## Desarrollo

En desarrollo, necesitas compilar el worker primero:

```bash
npm run build:worker
npm run dev
```

O ejecutar el build completo:

```bash
npm run build
npm start
```

## Verificación

Después del build, verifica que el worker esté compilado:

```bash
ls -la lib/workers/playwright-worker.js
```

O en producción:

```bash
ls -la .next/server/lib/workers/playwright-worker.js
```

## Troubleshooting

### Error: "Worker thread not found"
- Ejecuta `npm run build:worker` primero
- Verifica que el archivo existe en `lib/workers/playwright-worker.js`

### Error: "Module parse failed"
- Asegúrate de que `ignore-loader` esté instalado
- Verifica que la regla en `next.config.js` esté correcta

### Error en Docker build
- El Dockerfile ya incluye `npm run build:worker` antes del build
- Verifica que `esbuild` esté en `package.json`

## Ventajas

✅ Playwright completamente aislado del bundle  
✅ No más errores "File is not defined"  
✅ Mantiene todo en un solo proyecto  
✅ No requiere microservicio separado  
✅ Compatible con Railway y otros servicios  

