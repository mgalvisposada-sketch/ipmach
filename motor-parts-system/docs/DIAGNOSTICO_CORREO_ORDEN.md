# Diagnóstico: correo de confirmación de orden no llega

Cuando creas una orden, el servidor escribe en la **terminal del servidor** qué está haciendo con el correo. Usa esta guía para saber por qué no llega.

---

## 1. Dónde ver los mensajes (muy importante)

Los mensajes **solo salen en la terminal donde corre el servidor**, no en el navegador.

- **Desarrollo:** abre la terminal donde ejecutaste `npm run dev`. Los logs aparecen ahí.
- **No** uses la consola del navegador (F12 → Console): ahí no aparecen estos mensajes.
- Si cambiaste código, **reinicia el servidor** (Ctrl+C y luego `npm run dev` de nuevo).

Si **no sale nada** al crear la orden:
- Confirma que estás mirando la **misma** terminal donde está corriendo `npm run dev`.
- Deberías ver al menos: `[API ORDERS] POST /api/orders recibido` y luego `[API ORDERS] Orden #X creada...`. Si eso no aparece, la petición no está llegando a este servidor (por ejemplo estás usando otra URL o otro proceso).

---

## 2. Crea una orden de prueba

Con un cliente que **tenga email** en Usuarios, crea una orden desde admin (Búsqueda → seleccionar cliente → buscar referencia → añadir ítems → Crear orden).

---

## 3. Interpreta los mensajes en la terminal

### Si ves algo como:
```text
[Order 123] Sending confirmation email to client id=5 (ab***@gmail.com)...
[Order confirmation] Sending to ab***@gmail.com (order #123), PDF size: 45000 bytes
[Order confirmation] Sent successfully to ab***@gmail.com (order #123)
```
**El correo se envió.** Revisa en el cliente:
- Carpeta de **spam / correo no deseado**
- Que el email del usuario en Usuarios sea el correcto

---

### Si no sale NADA en la terminal al crear la orden

- Estás mirando la **terminal donde corre el servidor** (donde hiciste `npm run dev`), no la consola del navegador (F12).
- **Reinicia el servidor** después de cambiar código: Ctrl+C y luego `npm run dev`.
- Si usas otra URL (ej. app en producción), los logs estarán en el servidor de esa URL, no en tu PC.

---

### Si ves:
```text
[Order 123] Confirmation email not sent: client id=5 has no valid email...
```
**Ese usuario no tiene email (o tiene menos de 5 caracteres).**  
En **Usuarios** edita el cliente y guarda un email válido.

---

### Si ves:
```text
[Order confirmation email] Skipped: EMAIL_NOTIFICATIONS.order_confirmation.enabled is not true
```
**La notificación está desactivada en .env.**  
En `.env` la variable `EMAIL_NOTIFICATIONS` debe incluir:  
`"order_confirmation":{"enabled":true}`  
Reinicia el servidor después de cambiar `.env`.

---

### Si ves:
```text
[Order confirmation email] Skipped: SMTP not configured
```
**Faltan variables de SMTP.**  
En `.env` revisa: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (y opcionalmente `SMTP_FROM`).  
Ver `CONFIGURAR_CORREO_CORPORATIVO.md`.

---

### Si ves:
```text
[Order 123] Confirmation email failed: ...
```
o
```text
[SMTP] Send failed: ... (code: EAUTH) ...
```
**El envío falló (normalmente SMTP).**

- **EAUTH** → Gmail rechazó usuario/contraseña. Usa una **contraseña de aplicación** (no la contraseña normal). Ver `CONFIGURAR_CORREO_CORPORATIVO.md`.
- **Código distinto** → Copia el mensaje completo de la terminal (incluido el código y la línea que sigue) para buscar la causa o pedir soporte.

---

## 4. Resumen de comprobaciones

| Revisar | Dónde |
|--------|--------|
| Cliente tiene email (≥ 5 caracteres) | Usuarios → editar cliente |
| `order_confirmation.enabled: true` en EMAIL_NOTIFICATIONS | .env |
| SMTP configurado (host, user, password) | .env |
| Gmail: usar contraseña de aplicación | Cuenta Google → Seguridad → Contraseñas de aplicación |
| Carpeta spam del cliente | Bandeja del correo del cliente |

Si tras esto el correo sigue sin llegar, copia **todo** lo que salga en la terminal al crear la orden (desde `[Order ...]` hasta el final del error) y úsalo para seguir el diagnóstico o enviarlo a soporte.
