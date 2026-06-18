# Notificaciones por correo

El sistema puede enviar correos desde **proshel@proshelcorp.com** (o el remitente configurado en SMTP) para:

1. **Recuperar contraseña** (`password_reset`) – enlace para restablecer contraseña.
2. **Registro IPMach** (`ipmach_registration`) – notificación interna cuando alguien se registra por IPMach.
3. **Confirmación de orden** (`order_confirmation`) – cuando se crea una orden, se envía un correo al cliente con la confirmación y el PDF de la orden adjunto.

## Configuración en `.env`

- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (ver `CONFIGURAR_CORREO_CORPORATIVO.md`).
- **Qué notificaciones están activas**: variable `EMAIL_NOTIFICATIONS` (JSON).

Ejemplo de `EMAIL_NOTIFICATIONS` con todo habilitado:

```env
EMAIL_NOTIFICATIONS={"password_reset":{"enabled":true},"ipmach_registration":{"enabled":true,"to":"ventas@example.com"},"order_confirmation":{"enabled":true}}
```

| Clave | Descripción |
|-------|-------------|
| `password_reset.enabled` | Si `true`, se envían correos de “olvidé contraseña”. |
| `ipmach_registration.enabled` | Si `true`, se envía notificación al registrar por IPMach. |
| `ipmach_registration.to` | (Opcional) Correo al que se envía la notificación (ej. `ventas@tudominio.com`). |
| `order_confirmation.enabled` | Si `true`, al crear una orden se envía al cliente un correo de confirmación con el PDF de la orden adjunto. |

**Requisito para confirmación de orden:** el cliente (usuario) debe tener **email** en su perfil. Si no tiene email, no se envía el correo y la orden se crea igual.
