# Pasos para agregar OPENAI_API_KEY en la raíz del proyecto

**No compartas tu API key con nadie.** Solo tú debes verla y ponerla en el archivo `.env` en tu computadora.

---

## Paso 1: Ir a la raíz del proyecto

Abre la carpeta del proyecto en tu computadora. La **raíz** es la que contiene:

- `package.json`
- la carpeta `src/`
- la carpeta `mi-catalogo/`

Es decir: `motor-parts-system` (no una subcarpeta dentro de ella).

---

## Paso 2: Crear o abrir el archivo `.env`

En esa misma carpeta (raíz):

- Si ya existe un archivo llamado **`.env`**, ábrelo.
- Si **no** existe:
  - Clic derecho → **Nuevo archivo**
  - Nombre exacto: **`.env`** (con el punto al inicio)
  - En algunos editores el punto puede estar “oculto”; asegúrate de que el nombre sea solo `.env`

---

## Paso 3: Escribir la variable en una sola línea

Dentro del archivo `.env`, escribe en **una sola línea** (sin espacios antes ni después del `=`):

```env
OPENAI_API_KEY=sk-proj-tu-key-aqui
```

Reemplaza `sk-proj-tu-key-aqui` por tu key real. Debe quedar algo como:

```env
OPENAI_API_KEY=sk-proj-abc123def456...
```

- Sin espacios alrededor del `=`
- Sin comillas (a menos que tu key tenga espacios, cosa rara)
- Una sola línea por variable

Si ya tienes otras variables en `.env`, simplemente **añade esta línea** en cualquier parte del archivo (por ejemplo al final).

---

## Paso 4: Guardar el archivo

Guarda el archivo `.env` (Ctrl+S o Cmd+S).

---

## Paso 5: Reiniciar el servidor

Para que Next.js lea la nueva variable:

1. Si el servidor está corriendo (`npm run dev`), detenlo (Ctrl+C en la terminal).
2. Vuelve a ejecutar: `npm run dev`.
3. Abre http://localhost:3001/ipmach (o el puerto que uses), abre el asistente y haz una pregunta para probar.

---

## Resumen rápido

| Paso | Qué hacer |
|------|-----------|
| 1 | Estar en la carpeta raíz (donde está `package.json`) |
| 2 | Abrir o crear el archivo `.env` |
| 3 | Añadir la línea: `OPENAI_API_KEY=tu-key-real` |
| 4 | Guardar |
| 5 | Reiniciar `npm run dev` y probar en /ipmach |

Si algo no funciona, revisa que el nombre del archivo sea exactamente `.env` y que la variable se llame exactamente `OPENAI_API_KEY`.
