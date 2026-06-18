# Fix: Problema de Logout al Limpiar Datos

## 🐛 Problema Identificado

### Síntomas:
1. Al intentar limpiar datos históricos con contraseña incorrecta, el usuario era deslogueado
2. Los datos NO se eliminaban
3. El usuario era redirigido a la página de login

### Causa Raíz:

El problema estaba en el manejo de códigos de error HTTP:

**Flujo del Error**:
```
1. Usuario ingresa contraseña incorrecta
2. API devuelve status 401 (Unauthorized)
3. apiCall() intercepta el 401
4. apiCall() asume que la sesión expiró
5. Redirige automáticamente a /login
6. Usuario es deslogueado sin razón
```

**Código Problemático**:
```typescript
// En src/lib/api-client.ts
if (response.status === 401) {
    router.push('/login');  // ❌ Esto desloguea al usuario
}

// En src/app/api/analytics/clear-data/route.ts
if (!passwordMatch) {
    return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }  // ❌ Este 401 causa el logout
    );
}
```

## ✅ Solución Aplicada

### Cambios Realizados:

#### 1. Cambio de Código de Error (API)
```typescript
// ANTES ❌
if (!passwordMatch) {
    return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }  // Causaba logout
    );
}

// DESPUÉS ✅
if (!passwordMatch) {
    return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 403 }  // No causa logout
    );
}
```

**Razón**: 
- **401** debe usarse solo para problemas de autenticación de **sesión**
- **403** es apropiado para **autorización fallida** (contraseña incorrecta)

#### 2. Uso Directo de `fetch` (Frontend)
```typescript
// ANTES ❌
const response = await apiCall('/api/analytics/clear-data', {
    method: 'POST',
    body: JSON.stringify({ password, confirmText }),
});

// DESPUÉS ✅
const response = await fetch('/api/analytics/clear-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, confirmText }),
    credentials: 'include',
});
```

**Razón**:
- Evita el manejo automático de 401 por `apiCall()`
- Manejo manual de errores más preciso
- Mejor control del flujo

#### 3. Logging Mejorado
Se agregó logging detallado en:
- ✅ Frontend (modal): Logs de cada paso del proceso
- ✅ Backend (API): Logs de validación, eliminación y resultados
- ✅ Manejo de errores: Mensajes descriptivos

## 📋 Códigos de Error Correctos

### Para API de Limpieza:

| Código | Uso | Causa Logout |
|--------|-----|--------------|
| 200 | Éxito | No |
| 400 | Parámetros faltantes | No |
| 401 | Sesión expirada/inválida | **Sí** |
| 403 | Contraseña incorrecta / No admin | No |
| 404 | Usuario no encontrado | No |
| 500 | Error del servidor | No |

### Cuándo Usar Cada Código:

✅ **401 (Unauthorized)**: 
- No hay sesión activa
- Token JWT expirado
- Usuario no autenticado

✅ **403 (Forbidden)**:
- Contraseña incorrecta en verificación secundaria
- Usuario no es administrador
- Permisos insuficientes

## 🧪 Cómo Probar la Solución

### Test 1: Contraseña Incorrecta
```
1. Ir a /analytics/references
2. Click en "Limpiar Datos"
3. Ingresar contraseña INCORRECTA
4. Escribir "BORRAR DATOS"
5. Click en "Eliminar Datos"

✅ Resultado Esperado:
- Muestra error "Contraseña incorrecta"
- NO desloguea al usuario
- Puedes intentar de nuevo
```

### Test 2: Texto de Confirmación Incorrecto
```
1. Ir a /analytics/references
2. Click en "Limpiar Datos"
3. Ingresar contraseña CORRECTA
4. Escribir "borrar datos" (minúsculas)
5. Click en "Eliminar Datos"

✅ Resultado Esperado:
- Muestra error "Texto de confirmación incorrecto"
- NO desloguea al usuario
```

### Test 3: Limpieza Exitosa
```
1. Ir a /analytics/references
2. Click en "Limpiar Datos"
3. Ingresar contraseña CORRECTA
4. Escribir "BORRAR DATOS" (exacto)
5. Click en "Eliminar Datos"

✅ Resultado Esperado:
- Muestra progreso
- Muestra confirmación con cantidad eliminada
- Modal se cierra automáticamente
- Página se recarga
- Datos históricos eliminados
- Usuario sigue logueado ✅
```

## 🔍 Debugging

Si aún tienes problemas, revisa los logs:

### En el Navegador (Console):
```
[ClearData] Enviando petición de limpieza...
[ClearData] Respuesta recibida: 200
[ClearData] Datos de respuesta: { success: true, deleted: {...} }
[ClearData] Limpieza exitosa: { searchLogs: 123, userSessions: 45 }
```

### En el Servidor (Terminal):
```
[CLEAR DATA - 2026-02-12T...] Admin mauricio (ID: 1) iniciando limpieza...
[CLEAR DATA] Contando registros antes de eliminar...
[CLEAR DATA] Encontrados: 123 SearchLogs, 45 UserSessions
[CLEAR DATA] Eliminando SearchLogs...
[CLEAR DATA] SearchLogs eliminados: 123
[CLEAR DATA] Eliminando UserSessions...
[CLEAR DATA] UserSessions eliminados: 45
[CLEAR DATA] Limpieza completada exitosamente
[CLEAR DATA] Conexión a BD cerrada
```

### Errores Comunes y Soluciones:

**Error: "Contraseña incorrecta"**
- ✅ Solución: Ingresa la contraseña correcta de tu cuenta admin
- ⚠️ Nota: Las contraseñas son case-sensitive

**Error: "Texto de confirmación incorrecto"**
- ✅ Solución: Escribe exactamente `BORRAR DATOS` (todo en mayúsculas)

**Error: "Usuario no encontrado"**
- ⚠️ Problema: Sesión corrupta
- ✅ Solución: Cierra sesión y vuelve a iniciar

**Error 500: "Error al eliminar datos"**
- ⚠️ Problema: Error de base de datos
- ✅ Solución: Revisa logs del servidor para más detalles

## 📊 Verificar que los Datos se Eliminaron

Después de una limpieza exitosa:

### Método 1: Desde la UI
```
1. Ir a /analytics/references
2. Deberías ver:
   - Total Referencias: 0
   - Conversión Promedio: -
   - Gráficos vacíos
   - Tabla sin datos
```

### Método 2: Desde la Base de Datos
```sql
-- Verificar SearchLogs
SELECT COUNT(*) FROM "SearchLogs";
-- Resultado esperado: 0

-- Verificar UserSessions
SELECT COUNT(*) FROM "UserSessions";
-- Resultado esperado: 0

-- Verificar que Users NO se eliminaron
SELECT COUNT(*) FROM "Users";
-- Resultado esperado: > 0 (tus usuarios siguen ahí)

-- Verificar que Orders NO se eliminaron
SELECT COUNT(*) FROM "Orders";
-- Resultado esperado: el mismo que antes
```

## 🔄 Archivos Modificados

1. **src/app/api/analytics/clear-data/route.ts**
   - Cambio de status 401 → 403 para contraseña incorrecta
   - Logging mejorado en cada paso
   - Mejor manejo de errores con try-catch

2. **src/components/analytics/ClearDataModal.tsx**
   - Uso de `fetch()` directo en lugar de `apiCall()`
   - Logging de frontend para debugging
   - Credentials: 'include' para enviar cookies

## ✨ Mejoras Adicionales Aplicadas

1. **Logging Detallado**: Cada paso del proceso se registra
2. **Manejo de Errores Robusto**: Try-catch en operaciones críticas
3. **Mensajes Descriptivos**: Errores claros y accionables
4. **Validación Mejorada**: Verificaciones en múltiples niveles

## 📝 Notas Importantes

- ✅ El fix NO afecta otras funcionalidades del sistema
- ✅ La autenticación de sesión sigue funcionando igual
- ✅ Solo afecta el endpoint de limpieza de datos
- ⚠️ Recuerda que la limpieza es **irreversible**

---

**Status**: ✅ SOLUCIONADO  
**Versión**: 1.1.1  
**Fecha**: 2026-02-12  
**Probado**: Sí
