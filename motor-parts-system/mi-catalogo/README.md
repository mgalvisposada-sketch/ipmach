# Catálogo PDF — Base de conocimiento (no expuesta)

El contenido del PDF se usa como **base de conocimiento interna**. No se muestra ningún listado público del catálogo: cuando un cliente hace una pregunta en el asistente de IPMach, la respuesta se obtiene consultando este contenido.

## Archivo fuente

- `product-overview-2025.pdf`: catálogo completo (part numbers, descripciones, usos).

## Generar la base de conocimiento

1. Instalar dependencias (si aún no está instalado `pdf-parse`):
   ```bash
   npm install
   ```

2. Extraer texto del PDF:
   ```bash
   npm run catalog:extract
   ```

3. Salida (solo uso interno, no expuesta en la web):
   - `mi-catalogo/extracted-raw.txt`: texto crudo del PDF. Es lo que usa el asistente para responder preguntas.
   - `mi-catalogo/catalog-data.json`: ítems extraídos (respaldo si no existe el .txt).

El script filtra secciones irrelevantes (historia, fundadores, etc.). Si hace falta, se puede afinar la lógica en `scripts/extract-catalog-pdf.ts` tras revisar `extracted-raw.txt`.

## Cómo se usa

- El **asistente** (widget de chat en /ipmach) envía la pregunta del usuario a `POST /api/ipmach/ask`.
- La API busca en `extracted-raw.txt` (o en `catalog-data.json`) los fragmentos relevantes y, si está configurada `OPENAI_API_KEY`, devuelve una respuesta generada a partir de ese contenido.
- El cliente solo ve la respuesta del asistente; el catálogo no se expone en ninguna página ni API pública.
