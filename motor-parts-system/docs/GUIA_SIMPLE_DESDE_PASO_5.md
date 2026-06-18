# Guía simple: desde el paso 5 (sin asumir conocimientos)

Supón que ya hiciste los pasos 1 a 4 (Supabase, SQL, copiaste la cadena de conexión, y ejecutaste `npm install`). Aquí seguimos **desde el paso 5**, explicado como si fuera la primera vez.

---

## Paso 5: Poner la “dirección” de Supabase en tu proyecto

Tu proyecto necesita saber **dónde** está la base de datos en Supabase. Eso se guarda en un archivo que se llama **`.env`**.

### 5.1 – Encontrar el archivo `.env`

1. Abre **Cursor** (o el programa donde editas el proyecto).
2. En el panel de la **izquierda** verás la lista de carpetas y archivos.
3. Busca un archivo que se llame exactamente **`.env`** (con el punto al inicio).
   - Puede estar “arriba de todo”, al lado de `package.json` y de la carpeta `src`.
   - Si no lo ves, puede que esté oculto: en algunos editores hay que activar “mostrar archivos ocultos” o “show hidden files”.
4. Haz **clic** en `.env` para abrirlo. Verás varias líneas con nombres en mayúsculas y valores (por ejemplo `DATABASE_URL=...`, `OPENAI_API_KEY=...`).

### 5.2 – Añadir la línea de Supabase

1. Ve al **final** del archivo (baja con la tecla Fin o desplazándote).
2. Pulsa **Enter** para dejar una línea en blanco.
3. En esa línea nueva, escribe **exactamente** esto (y luego pegas tu cadena):

   ```
   IPMACH_VECTOR_DATABASE_URL=
   ```

   Después del **=** (sin espacio) vas a pegar la “cadena de conexión” que copiaste en el Paso 3 de la guía principal.

4. Esa cadena se ve más o menos así (la tuya tendrá otros números y letras):

   ```
   postgresql://postgres.abcdefgh:MI_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

   Lo importante: donde dice **`[YOUR-PASSWORD]`** o donde deba ir la contraseña, **tú** debes poner la contraseña real de la base de datos de Supabase (la que pusiste al crear el proyecto, o la que ves en Supabase en Project Settings → Database).

5. Queda así (ejemplo; **usa tu propia cadena**, no copies esta):

   ```
   IPMACH_VECTOR_DATABASE_URL=postgresql://postgres.abcdefgh:MiPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

6. **Guarda** el archivo (Ctrl+S o Cmd+S).

No hace falta que entiendas qué significa cada parte; solo que esa línea le dice al proyecto: “la base vectorial del asistente está en esta dirección de Supabase”.

---

## Paso 6: Generar el texto del catálogo (si aún no lo hiciste)

Antes de “llenar” Supabase, el proyecto necesita un archivo de **texto** que sale de tu PDF. Eso se hace con un comando en la **terminal**.

### 6.1 – Abrir la terminal

- En **Cursor**: menú **Terminal** → **New Terminal** (o **Terminal** → **Nueva terminal**).
- Se abrirá una ventanita abajo con una línea donde puedes escribir (suele terminar en `$` o `%`).

### 6.2 – Ir a la carpeta del proyecto

En esa ventana escribe (y luego Enter):

```bash
cd /Users/mauriciogalvis/PROYECTOS/ciparcol/motor-parts-system
```

(Si tu proyecto está en otra ruta, usa esa. El `cd` es “entrar a esta carpeta”.)

### 6.3 – Ejecutar el comando que extrae el texto del PDF

Escribe esto y pulsa Enter:

```bash
npm run catalog:extract
```

- Puede tardar un poco (segundos o un minuto).
- Al terminar debería decir algo como “Raw text saved to…” y “Extracted items…”.
- Si sale un error de “PDF not found”, revisa que el archivo `mi-catalogo/product-overview-2025.pdf` exista.

Cuando termine bien, ya tienes el archivo `mi-catalogo/extracted-raw.txt` listo para el siguiente paso.

---

## Paso 7: Llenar la base de Supabase con ese texto (ingesta)

Ahora le decimos al proyecto: “toma el texto del catálogo, córtalo en trozos, y guarda esos trozos en Supabase”. Eso es la **ingesta**.

### 7.1 – Misma terminal, mismo lugar

Sigue en la misma terminal, en la carpeta del proyecto (la que usaste en el paso 6).

### 7.2 – Ejecutar la ingesta

Escribe y pulsa Enter:

```bash
npm run catalog:ingest
```

- Puede tardar **varios minutos** (depende del tamaño del catálogo).
- Verás que va mostrando “Inserted X / Y” (insertados X de Y).
- Al final debería decir algo como “Done. Total rows inserted: …” (sin errores en rojo).

Si sale error de “OPENAI_API_KEY” o “connection”, vuelve al paso 5 y revisa que en `.env` esté bien la línea `IPMACH_VECTOR_DATABASE_URL` (con la contraseña correcta) y que también esté `OPENAI_API_KEY=sk-...`.

### 7.3 – Comprobar que se guardó algo

Escribe y pulsa Enter:

```bash
npm run catalog:vector-status
```

Deberías ver:
- **Total de fragmentos indexados:** un número mayor que 0.
- **Estado: indexación correcta.**

Si sale “Total: 0”, la ingesta no guardó nada; revisa los errores del paso 7.2 y la configuración del paso 5.

---

## Paso 8: Probar el asistente en el navegador

### 8.1 – Arrancar la app

En la **misma terminal** (o en una nueva en la misma carpeta), escribe:

```bash
npm run dev
```

Espera a que diga algo como “Ready” o “compiled successfully”. No cierres esa ventana.

### 8.2 – Abrir la página del asistente

1. Abre tu **navegador** (Chrome, Safari, etc.).
2. En la barra de direcciones escribe: **`http://localhost:3001/ipmach`** (o el puerto que te haya dicho la terminal, por ejemplo 3000).
3. Pulsa Enter.

### 8.3 – Abrir el chat del asistente

- En la esquina **inferior derecha** de la página suele haber un **botón redondo** (chat).
- Haz **clic** ahí para abrir el asistente.

### 8.4 – Hacer una pregunta

En el cuadro de texto escribe algo como:
- “¿Qué part numbers hay para filtros?”
- o “bomba hidráulica para 320”

y envía. Si todo está bien, el asistente responderá usando la base vectorial de Supabase.

---

## Resumen “para no perderse”

| Paso | Dónde   | Qué haces en una frase |
|------|--------|-------------------------|
| **5** | Archivo `.env` | Añadir una línea: `IPMACH_VECTOR_DATABASE_URL=` y pegar la cadena de Supabase (con tu contraseña). Guardar. |
| **6** | Terminal | `npm run catalog:extract` (genera el texto del PDF). |
| **7** | Terminal | `npm run catalog:ingest` (sube ese texto a Supabase). Luego `npm run catalog:vector-status` para comprobar. |
| **8** | Navegador | `npm run dev`, luego abrir `http://localhost:3001/ipmach` y probar una pregunta en el asistente. |

Si te atascas en un paso concreto (por ejemplo “no encuentro el .env” o “me da error al hacer ingest”), dime **en qué paso** y **qué mensaje exacto te sale** (o una captura) y te guío solo en ese punto.

---

## Si sale: "password authentication failed for user postgres"

Ese mensaje significa que la **contraseña** que está en `IPMACH_VECTOR_DATABASE_URL` no es la correcta para la base de datos de Supabase. Haz esto:

1. **Abrir Supabase**  
   Entra a [supabase.com](https://supabase.com), inicia sesión y abre tu proyecto.

2. **Ver o resetear la contraseña**  
   - Menú izquierdo: **Project Settings** (icono de engranaje).  
   - Pestaña **Database**.  
   - En **Database password** verás la contraseña (o un botón para mostrarla). Si no la recuerdas, usa **Reset database password**, copia la nueva y guárdala en un lugar seguro.

3. **Corregir el `.env`**  
   - Abre el archivo `.env` en tu proyecto.  
   - Busca la línea que empieza por `IPMACH_VECTOR_DATABASE_URL=`.  
   - La cadena tiene esta forma: `postgresql://postgres.XXXX:CONTRASEÑA_AQUÍ@...`  
   - Sustituye la parte de la contraseña (entre los dos `:` después de `postgres.xxxx`) por la contraseña correcta de Supabase.  
   - Si tu contraseña tiene caracteres raros (por ejemplo `@`, `#`, `%`, `/`), en la URL hay que codificarlos: `@` → `%40`, `#` → `%23`, `%` → `%25`, `/` → `%2F`.  
   - Guarda el archivo.

4. **Probar de nuevo**  
   En la terminal: `npm run catalog:vector-status`. Si la contraseña es correcta, ya no debería salir el error de autenticación.
