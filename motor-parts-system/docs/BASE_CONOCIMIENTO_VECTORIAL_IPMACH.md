# Base de conocimiento vectorial para el asistente IPMach

## Por qué pasar a una base vectorizada

Hoy el asistente usa **texto extraído del PDF** y una búsqueda por **palabras clave**. Eso tiene límites:

- La extracción del PDF puede perder tablas, formato y contexto.
- Buscar por palabras exactas no captura sinónimos ni frases parecidas (“bomba hidráulica” vs “hydraulic pump”).
- Es difícil añadir más fuentes (horarios, políticas, FAQs) y que el agente las use bien.

Con una **base de conocimiento vectorizada**:

1. **Búsqueda semántica**: se buscan fragmentos por *significado*, no solo por palabras. “Bomba para 320” puede emparejar texto que diga “hydraulic pump for 320D”.
2. **Mejor uso del PDF**: se trocea el texto en chunks, se convierten en vectores (embeddings) y se guardan. No dependes tanto de una extracción perfecta; lo que se extrae se aprovecha mejor.
3. **Varias fuentes en el mismo sitio**: catálogo PDF, horarios, políticas, preguntas frecuentes, etc. Todo se indexa igual y el agente recupera lo que aplique a la pregunta.

---

## Stack recomendado

| Componente | Opción recomendada | Alternativas |
|------------|--------------------|--------------|
| **Embeddings** | OpenAI `text-embedding-3-small` | `text-embedding-ada-002`, Cohere, open source (e.g. sentence-transformers) |
| **Base vectorial** | **Supabase (pgvector)** si ya usas Postgres | **Pinecone**, **Chroma** (local o servidor), **Weaviate** |
| **Orquestación** | Tu API actual (`/api/ipmach/ask`) | LangChain, LlamaIndex (opcional) |

Ventaja de **Supabase + pgvector**: mismo proyecto, tablas normales + extensión vectorial, sin otro servicio.  
Ventaja de **Pinecone/Chroma**: muy enfocados en búsqueda por similitud, poco mantenimiento.

---

## Flujo de alto nivel

### 1. Inyectar el PDF (y otros documentos)

```
PDF / TXT / MD  →  Chunking (p. ej. 500–800 tokens, overlap 100)
                →  Por cada chunk: OpenAI Embeddings API → vector
                →  Guardar en DB: (vector, texto, metadata: origen, página, tipo)
```

- **Chunking**: párrafos o ventanas de tamaño fijo con solapamiento para no cortar frases importantes.
- **Metadata**: `source: "catalog-2025"`, `page: 12`, `type: "catalog"` para filtrar después si quieres (solo catálogo, solo políticas, etc.).
- Lo mismo para horarios y políticas: trozos de texto → embed → misma tabla con `source: "company-info"`, `type: "hours"` o `"policies"`.

### 2. Añadir información de la empresa

- **Horarios**: texto en Markdown o TXT, por ejemplo: “Atención Lunes a Viernes 8:00–17:00, Sábados 8:00–12:00.”
- **Políticas**: devoluciones, garantías, envíos, etc. en uno o varios archivos.
- **FAQs**: preguntas y respuestas en un doc o en una tabla.

Todos se procesan igual: chunk → embed → insert en la misma tabla vectorial, con `source` y `type` distintos. El agente no necesita saber de qué archivo vino; la búsqueda por similitud trae lo relevante.

### 3. Cuando el usuario pregunta (en el widget)

```
Pregunta del usuario  →  Embed de la pregunta (mismo modelo que los chunks)
                      →  Búsqueda por similitud (top-k, p. ej. k=10–20)
                      →  Recuperar los chunks más parecidos
                      →  Armar contexto con esos chunks (+ opcional: filtro por type/source)
                      →  Enviar a OpenAI Chat (como ahora): contexto + pregunta
                      →  Respuesta al usuario
```

Así el agente usa “todo” lo que hay en la base: catálogo, horarios, políticas, etc., según lo que sea más parecido a la pregunta.

---

## Pasos concretos sugeridos

1. **Elegir dónde guardar vectores**
   - Si ya tienes Supabase/Postgres: activar extensión `pgvector` y crear una tabla `ipmach_knowledge (id, content, embedding vector(1536), source, type, metadata jsonb)`.
   - Si prefieres servicio dedicado: cuenta en Pinecone o Chroma, índice creado con la misma dimensión que el embedding (p. ej. 1536 para `text-embedding-3-small`).

2. **Script de ingesta (una vez o cuando cambie el contenido)**
   - Leer `mi-catalogo/extracted-raw.txt` (y en el futuro, más archivos).
   - Chunkear con tamaño y overlap fijos (p. ej. 500 tokens, 100 de overlap).
   - Por cada chunk: llamar a OpenAI Embeddings, guardar `(content, embedding, source, type)` en la base vectorial.
   - Incluir en el mismo flujo archivos de horarios, políticas, etc., con `source`/`type` distintos.

3. **Cambiar `/api/ipmach/ask`**
   - En lugar de `selectRelevantChunks` sobre el texto plano, hacer: embed de la pregunta → búsqueda por similitud en la tabla → usar los chunks devueltos como contexto para el LLM.
   - Mantener el mismo formato de respuesta (idioma del usuario, solo basado en el contexto, etc.).

4. **Opcional**
   - Filtros por `type` (solo catálogo, solo políticas) si quieres que ciertas preguntas solo usen una parte de la base.
   - Re-ingestar cuando actualices el PDF o los textos de empresa (script + cron o manual).

---

## Resumen

- **Botón “Te ayudamos a encontrarlo”**: ya está conectado al widget; al hacer clic se dispara el evento que abre el asistente.
- **Base vectorizada**: recomendable para no depender solo del PDF extraído y para incluir horarios, políticas y más. Opción práctica: **OpenAI embeddings + Supabase pgvector** (o Pinecone/Chroma), chunking del PDF y de los textos de empresa, y que `/api/ipmach/ask` use búsqueda por similitud en lugar de búsqueda por palabras clave.

Si quieres, el siguiente paso puede ser esbozar la tabla en Supabase (o el índice en Pinecone) y el script de ingesta en este repo (Node/TS) usando el PDF actual y un par de archivos de ejemplo de horarios/políticas.
