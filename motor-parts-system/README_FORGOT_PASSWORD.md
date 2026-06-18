# Recuperar contraseña

## Opción 1: Contactar al administrador

Si hay otro usuario con rol **admin**, puede restablecer tu contraseña desde el menú **Usuarios**: editar tu usuario y guardar una nueva contraseña en el campo correspondiente.

## Opción 2: Flujo normal (recomendado)

1. En la pantalla de inicio de sesión, haz clic en **¿Olvidaste tu contraseña?**
2. Ingresa el **correo electrónico** asociado a tu cuenta.
3. Si existe una cuenta con ese correo, recibirás un enlace por email en unos minutos.
4. Abre el enlace y crea una **nueva contraseña** (mínimo 6 caracteres). El enlace expira en 1 hora.
5. Inicia sesión con tu nueva contraseña.

Para que el envío de correo funcione, el servidor debe tener configuradas las variables de entorno de email (ver sección *Configuración de email* más abajo).

---

## Configuración de email (flujo normal)

Para que la opción 2 funcione, configura en `.env`:

| Variable | Descripción |
|----------|-------------|
| `RESEND_API_KEY` | API key de [Resend](https://resend.com). Sin esto no se envían correos. |
| `RESET_PASSWORD_FROM_EMAIL` | (Opcional) Email remitente. Por defecto Resend usa `onboarding@resend.dev`. |
| `NEXTAUTH_URL` o `NEXT_PUBLIC_APP_URL` | URL base de la app (ej. `http://localhost:3000`) para armar el enlace de restablecimiento. |

Ejemplo:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESET_PASSWORD_FROM_EMAIL=noreply@tudominio.com
NEXTAUTH_URL=http://localhost:3000
```

---

## Solo para desarrollo (seed)

Si ejecutaste el seed de Prisma, existe un usuario administrador por defecto para pruebas. **No uses credenciales por defecto en producción.**

- Usuario: `admin`
- Contraseña: `password123`

Puedes entrar con ese usuario y cambiar la contraseña desde tu perfil o desde Usuarios.
