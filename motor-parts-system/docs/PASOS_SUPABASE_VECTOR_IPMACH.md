# Paso a paso: Base vectorial en Supabase para el asistente IPMach

Esta guía te lleva desde cero hasta tener el asistente usando búsqueda por similitud en Supabase. No hace falta ser experto en programación; solo seguir los pasos en orden.

---

## Qué vas a hacer (resumen)

1. En Supabase: activar la extensión pgvector y crear la tabla donde se guardan los fragmentos del catálogo (y luego horarios, políticas, etc.).
2. En tu proyecto: instalar una dependencia (`pg`) y configurar una variable de entorno si usas otra base de datos para el resto de la app.
3. Ejecutar un script que lee el catálogo extraído, lo trocea, obtiene los “vectores” con OpenAI y los guarda en Supabase.
4. El asistente ya usará esa base vectorial para responder (el código del asistente se actualiza para consultar Supabase).

---

## Paso 1: Entrar a Supabase y abrir el SQL Editor

1. Entra a [https://supabase.com](https://supabase.com) e inicia sesión.
2. Abre tu **proyecto** (o crea uno nuevo si es solo para esto).
3. En el menú izquierdo, entra a **SQL Editor**.

---

## Paso 2: Ejecutar el SQL que crea la base vectorial

1. En el SQL Editor, pulsa **New query**.
2. Abre en tu proyecto el archivo **`scripts/supabase-ipmach-vector.sql`** (está en la raíz del repo).
3. Copia **todo** su contenido y pégalo en la ventana del SQL Editor.
4. Pulsa **Run** (o Ctrl+Enter).
5. Debe decir que se ejecutó correctamente. Eso crea la extensión `vector` y la tabla `ipmach_knowledge` donde se guardarán los fragmentos del catálogo (y más adelante horarios, políticas, etc.).

Si algo falla, revisa que el proyecto esté activo y que no haya restricciones en tu plan para crear extensiones.

---

## Paso 3: Obtener la cadena de conexión de Supabase

1. En Supabase, ve a **Project Settings** (icono de engranaje abajo a la izquierda).
2. Entra a **Database**.
3. Baja hasta **Connection string**.
4. Elige **URI** y copia la cadena. Se ve algo como:
   ```text
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
5. Donde dice `[YOUR-PASSWORD]` debes poner la **contraseña de la base de datos** (la que definiste al crear el proyecto, o la que ves/cambias en esa misma pantalla).
6. Guarda esa cadena completa en un lugar seguro (la usarás en el Paso 5).

---

## Paso 4: Instalar dependencia y script de ingesta

En la raíz del proyecto (donde está `package.json`), en la terminal:

```bash
npm install
```

Luego comprueba que exista el script de ingesta (debería estar en `scripts/ingest-catalog-to-vector.ts`). Si te lo han indicado en el proyecto, también puede que tengas que ejecutar algo como:

```bash
npm run catalog:ingest
```

(El nombre exacto del script puede ser `catalog:ingest` o el que figure en `package.json`.)

---

## Paso 5: Configurar la variable de entorno para la base vectorial

- Si **toda** tu app usa ya Supabase como base de datos (tu `DATABASE_URL` es de Supabase), no hace falta otra variable: el script y el asistente usarán `DATABASE_URL` para la tabla vectorial también.
- Si usas **otra** base de datos para el resto de la app (por ejemplo Railway), necesitas una variable **solo** para la base vectorial del asistente:

1. En la raíz del proyecto, abre el archivo **`.env`**.
2. Añade una línea con la cadena que copiaste en el Paso 3 (con la contraseña ya puesta):

   ```env
   IPMACH_VECTOR_DATABASE_URL="postgresql://postgres.[REF]:TU_PASSWORD@aws-0-xx.pooler.supabase.com:6543/postgres"
   ```

   (Sustituye `TU_PASSWORD` por la contraseña real. Si la cadena tiene caracteres raros, puede ir entre comillas.)

3. Guarda el archivo.

Si tu app ya usa Supabase, solo asegúrate de que `DATABASE_URL` en `.env` sea la cadena de ese mismo proyecto (y que hayas ejecutado el SQL del Paso 2 en ese proyecto).

---

## Paso 6: Tener el catálogo extraído

El script de ingesta lee el texto que se extrae del PDF. Ese texto se genera con:

```bash
npm run catalog:extract
```

Si ya lo hiciste antes, no hace falta repetirlo. Si no, ejecútalo una vez (y asegúrate de que exista `mi-catalogo/product-overview-2025.pdf` o el PDF que uses).

---

## Paso 7: Llenar la base vectorial (ingesta)

En la raíz del proyecto:

```bash
npm run catalog:ingest
```

Ese script:

- Lee `mi-catalogo/extracted-raw.txt` (o el archivo que esté configurado).
- Lo divide en fragmentos (chunks).
- Llama a la API de OpenAI para obtener el “embedding” de cada fragmento.
- Inserta cada fragmento y su vector en la tabla `ipmach_knowledge` en Supabase.

Debe terminar sin errores y mostrando algo como “Insertados X fragmentos” o similar. Si falla, revisa:

- Que `OPENAI_API_KEY` esté en `.env`.
- Que `IPMACH_VECTOR_DATABASE_URL` (o `DATABASE_URL`) sea la cadena correcta de Supabase con la contraseña bien puesta.

---

## Cómo validar que el PDF está indexado

**Opción A – Desde tu proyecto (recomendado)**  
En la terminal, en la raíz del proyecto:

```bash
npm run catalog:vector-status
```

Deberías ver algo como:
- **Total de fragmentos indexados:** un número mayor que 0 (p. ej. 200).
- **Por origen:** `catalog-2025 | catalog → X fragmentos`.
- **Muestra de contenido:** 3 filas con un trozo del texto.
- **Estado: indexación correcta.**

Si sale **Total: 0**, la tabla está vacía: ejecuta `npm run catalog:ingest` y vuelve a correr `catalog:vector-status`.

**Opción B – Desde Supabase**  
1. Entra a tu proyecto en Supabase → **SQL Editor**.  
2. Nueva consulta y ejecuta:

```sql
SELECT COUNT(*) AS total FROM ipmach_knowledge;
SELECT source, type, COUNT(*) FROM ipmach_knowledge GROUP BY source, type;
```

Si `total` es mayor que 0 y ves filas con `source = 'catalog-2025'`, el PDF está indexado en la base vectorial.

---

## Paso 8: Probar el asistente

1. Arranca la app (por ejemplo `npm run dev`).
2. Entra a la página del asistente IPMach (por ejemplo `http://localhost:3001/ipmach`).
3. Abre el widget del asistente y haz una pregunta sobre el catálogo (por ejemplo: “¿Qué part numbers hay para filtros?” o “bomba hidráulica para 320”).

Si todo está bien, las respuestas deberían basarse en los fragmentos que se guardaron en Supabase (búsqueda por similitud). Si no, revisa que el Paso 7 haya terminado bien y que no haya errores en la consola del navegador o en la terminal del servidor.

---

## Resumen rápido

| Paso | Dónde | Qué haces |
|------|--------|-----------|
| 1–2 | Supabase → SQL Editor | Pegar y ejecutar `scripts/supabase-ipmach-vector.sql` |
| 3 | Supabase → Project Settings → Database | Copiar Connection string (URI) y completar la contraseña |
| 4 | Terminal en el proyecto | `npm install` |
| 5 | Archivo `.env` | Añadir `IPMACH_VECTOR_DATABASE_URL` (o usar `DATABASE_URL` si ya es Supabase) |
| 6 | Terminal | `npm run catalog:extract` (si aún no lo has hecho) |
| 7 | Terminal | `npm run catalog:ingest` |
| 8 | Navegador | Probar preguntas en el asistente |

---

## Añadir más información (horarios, políticas, etc.)

Cuando quieras que el asistente use también horarios, políticas o FAQs:

1. Crea uno o varios archivos de texto (o Markdown) en tu proyecto, por ejemplo en `mi-catalogo/company-info/` (horarios.txt, politicas.txt, etc.).
2. En el script de ingesta (o en un script parecido) se añade la lógica para leer esos archivos, trocearlos y subirlos a la misma tabla `ipmach_knowledge`, usando en `source` o `type` un valor como `company-info` o `policies` para distinguirlos del catálogo.
3. Vuelves a ejecutar la ingesta (o solo para esos archivos). El asistente seguirá usando la misma búsqueda por similitud y traerá también fragmentos de horarios o políticas cuando la pregunta sea parecida.

Si quieres, en el siguiente paso se puede detallar exactamente cómo añadir esa carpeta y el código del script para esos archivos.
