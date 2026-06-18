# Cómo hacer que los correos salgan desde proshel@proshelcorp.com

Tu dominio está en GoDaddy pero el correo **proshel@proshelcorp.com** lo administra Gmail (Google Workspace). Para que la aplicación pueda enviar correos desde esa cuenta, Google pide usar una **“Contraseña de aplicación”** en lugar de tu contraseña normal. Aquí los pasos, sin asumir que sabes de programación.

---

## Paso 1: Entrar a la cuenta de Google

1. Abre el navegador y ve a [https://myaccount.google.com](https://myaccount.google.com).
2. Inicia sesión con **proshel@proshelcorp.com** (la contraseña que usas para ese correo).

---

## Paso 2: Activar la verificación en dos pasos (obligatorio)

Google **solo muestra** la opción “Contraseñas de aplicación” cuando la verificación en dos pasos está **activada**. Si en tu pantalla dice **“2-Step Verification is off”**, primero debes activarla.

1. En la misma página de **Seguridad** → **Cómo inicias sesión en Google** (donde estás ahora).
2. Haz clic en la primera opción: **“2-Step Verification”** (donde dice “is off”).
3. Sigue los pasos que te pida Google (confirmar contraseña, número de teléfono, código por SMS o llamada).
4. Cuando termines, la verificación en dos pasos quedará **Activada**. **Solo entonces** podrás ver la opción del Paso 3.

---

## Paso 3: Crear la Contraseña de aplicación

**Importante:** Esta opción **solo aparece después** de que la verificación en dos pasos esté activada. Si no la ves, vuelve al Paso 2 y actívala.

1. Vuelve a **Seguridad**: [https://myaccount.google.com/security](https://myaccount.google.com/security).
2. En **“Cómo acceder a Google”** / “How you sign in to Google”, busca y haz clic en **“Contraseñas de aplicación”** (en inglés: **“App passwords”**).
   - A veces está dentro de la página de “2-Step Verification”: entra a **2-Step Verification** y al final de esa página suele aparecer el enlace **“App passwords”**.
3. Donde dice **“Seleccionar app”**, elige **Correo** (o **Otra (nombre personalizado)** y escribe por ejemplo “Motor Parts”).
4. Donde dice **“Seleccionar dispositivo”**, elige **Otro** y escribe por ejemplo “Servidor de la app”.
5. Haz clic en **Generar**.
6. Google te mostrará una **contraseña de 16 caracteres** (con espacios, tipo: `abcd efgh ijkl mnop`). **Cópiala** (puedes quitar los espacios al pegarla).

---

## Paso 4: Poner esa contraseña en la aplicación

1. En tu computador, abre el archivo **`.env`** del proyecto (está en la carpeta raíz de motor-parts-system).
2. Busca la línea que dice:
   ```env
   SMTP_PASSWORD=PON_AQUI_TU_CONTRASEÑA_DE_APLICACION
   ```
3. **Sustituye** `PON_AQUI_TU_CONTRASEÑA_DE_APLICACION` por la contraseña de 16 caracteres que te dio Google (sin espacios, todo junto).  
   Ejemplo: si Google te dio `abcd efgh ijkl mnop`, la línea puede quedar:
   ```env
   SMTP_PASSWORD=abcdefghijklmnop
   ```
4. **Guarda** el archivo `.env`.

---

## Paso 5: Reiniciar la aplicación (si está corriendo)

Si la aplicación ya estaba abierta o corriendo en el servidor, **ciérrala y vuélvela a abrir** (o reinicia el servidor) para que lea la nueva contraseña del `.env`.

---

## Resumen

- **Correo desde el que saldrán los mensajes:** proshel@proshelcorp.com (ya está configurado en `.env`).
- **Lo único que tú debes hacer:** crear la “Contraseña de aplicación” en Google (Pasos 1–3) y pegarla en `SMTP_PASSWORD` en el archivo `.env` (Paso 4).

Si en algún paso no ves las mismas opciones (por ejemplo, si tu cuenta es de una organización que limita estas opciones), dime en qué paso te quedaste y qué ves en pantalla y te guío con eso.
