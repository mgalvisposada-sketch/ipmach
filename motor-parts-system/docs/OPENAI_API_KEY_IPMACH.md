# OPENAI_API_KEY — Asistente IPMach (base de conocimiento del catálogo)

El asistente de IPMach responde preguntas usando el contenido del catálogo PDF. Para que genere respuestas con IA necesitas una **API key de OpenAI**. Sin ella, el asistente puede devolver solo un mensaje indicando que configures la key o fragmentos de texto relevantes.

---

## 1. Obtener la API key de OpenAI

1. Entra a **https://platform.openai.com** e inicia sesión (o crea una cuenta).
2. Ve a **API keys**: https://platform.openai.com/api-keys
3. Pulsa **“Create new secret key”**, ponle un nombre (ej. `IPMach`) y copia la key.  
   - Empieza por `sk-...`.  
   - **Solo se muestra una vez**; si la pierdes, tendrás que crear otra.
4. En la misma cuenta puedes ver uso y facturación en **Usage** / **Billing**. El uso del asistente (modelo `gpt-4o-mini`) suele ser barato.

---

## 2. Usar la key en tu máquina (desarrollo)

1. En la **raíz del proyecto** (donde está `package.json`) crea o edita el archivo **`.env`** (o `.env.local`).
2. Añade una línea con la key (sin comillas si no hay espacios):

   ```env
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **No subas `.env` a Git** (ya está en `.gitignore`).
4. Reinicia el servidor de desarrollo (`npm run dev`) para que cargue la variable.
5. Prueba en **http://localhost:3001/ipmach** abriendo el asistente y haciendo una pregunta sobre el catálogo.

---

## 3. Usar la key en producción

La key debe estar definida como **variable de entorno** en el sitio donde despliegas (servidor, Vercel, Railway, etc.), no en el código.

### Vercel

1. Proyecto → **Settings** → **Environment Variables**.
2. Añade:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** tu key (`sk-...`)
   - **Environments:** Production (y opcionalmente Preview).
3. Guarda y vuelve a desplegar si ya estaba desplegado.

### Railway

1. En tu proyecto/servicio → **Variables**.
2. Añade variable:
   - **Variable:** `OPENAI_API_KEY`
   - **Value:** tu key.
3. Redeploy para aplicar cambios.

### Otro servidor (VPS, PM2, Docker, etc.)

- Exporta la variable en el entorno antes de arrancar la app, por ejemplo:
  - `export OPENAI_API_KEY=sk-...` y luego `npm run start`, o
  - En el archivo de configuración de tu proceso (systemd, PM2, Docker `env`, etc.) define `OPENAI_API_KEY=sk-...`.

---

## 4. Comprobar que funciona

- En **/ipmach**, abre el asistente (botón del chat).
- Escribe algo como: *“¿Qué part numbers hay para filtros?”* o *“Describe el producto X”* (según lo que tenga tu catálogo).
- Si la key está bien configurada, deberías recibir una respuesta generada a partir del contenido del PDF. Si no, revisa que:
  - El nombre de la variable sea exactamente `OPENAI_API_KEY`.
  - Hayas ejecutado `npm run catalog:extract` para tener `mi-catalogo/extracted-raw.txt` (o `catalog-data.json`).
  - En producción, hayas re-desplegado después de añadir la variable.

---

## 5. Seguridad

- **Nunca** subas la key al repositorio ni la pongas en el código.
- Usa siempre variables de entorno (`.env` en local, panel de tu hosting en producción).
- Si crees que la key se ha filtrado, revócela en https://platform.openai.com/api-keys y crea una nueva.
