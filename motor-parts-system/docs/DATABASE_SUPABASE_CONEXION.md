# Conexión a Supabase y error "Connection Closed"

## Por qué salía el error

Con **puerto 6543** (PgBouncer / connection pooler), Supabase cierra las conexiones que llevan un rato sin usarse. Prisma sigue usando esas conexiones en su pool y, al reutilizarlas, aparece:

```text
prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }
```

## Solución en desarrollo local

En `.env` se dejó la **conexión directa** (puerto **5432**) para desarrollo:

- **5432** → Conexión directa a Postgres. No pasa por PgBouncer, la conexión no se cierra por inactividad y el error desaparece.
- **6543** → Pooler (PgBouncer). Útil en producción/serverless, pero en un proceso largo (ej. `npm run dev`) las conexiones inactivas se cierran y aparece el error.

## Si desplegas en producción (Vercel, etc.)

En entornos serverless (cada request es un proceso corto) suele ir mejor el **pooler (6543)** con `?pgbouncer=true` para no agotar conexiones. Si en producción ves "Connection Closed", valora usar también la URL directa (5432) si tu hosting mantiene el proceso vivo.

Reinicia el servidor después de cambiar `DATABASE_URL`.
