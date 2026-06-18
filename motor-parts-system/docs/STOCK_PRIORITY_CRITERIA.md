# Criterios de Prioridad para Stock Propio

Este documento explica cómo el sistema determina si un producto es **Prioridad Alta**, **Prioridad Media** o **Considerar** (y por tanto si aparece como "recomendado para stock propio").

## Resumen en una frase

Se calcula un **score de 0 a 100** con cuatro factores (conversión, volumen, tendencia y revenue). Según ese score se asigna la prioridad.

---

## 1. Cálculo del score (0–100)

El score es una **suma ponderada** de cuatro factores. Cada factor aporta un sub-score de 0 a 100; luego se multiplica por su peso y se suma.

| Factor        | Peso | Qué mide |
|---------------|------|----------|
| **Conversión**| 40%  | % de búsquedas que se convirtieron en orden de compra |
| **Volumen**   | 30%  | Cantidad de búsquedas de esa referencia en el período |
| **Tendencia** | 20%  | Si la demanda va subiendo, estable o bajando |
| **Revenue**   | 10%  | Ingresos totales (USD) generados por esa referencia |

**Fórmula:**  
`Score = (conversión_score × 0.40) + (volumen_score × 0.30) + (tendencia_score × 0.20) + (revenue_score × 0.10)`

---

## 2. Cómo se puntúa cada factor

### Conversión (peso 40%)

| Conversión        | Sub-score | Comentario |
|------------------|-----------|------------|
| ≥ 50%            | 100       | Excelente  |
| ≥ 40%            | 80        | Muy buena  |
| ≥ 30% (mínimo)   | 60        | Aceptable  |
| ≥ 20%            | 30        | Baja       |
| > 0%             | 10        | Muy baja   |
| 0%               | 0         | Sin conversiones |

### Volumen de búsquedas (peso 30%)

| Búsquedas | Sub-score |
|-----------|-----------|
| ≥ 100     | 100       |
| ≥ 50      | 80        |
| ≥ 20 (mínimo por defecto) | 60 |
| ≥ 10      | 30        |
| < 10      | 10        |

### Tendencia (peso 20%)

| Tendencia   | Sub-score |
|------------|-----------|
| Creciente  | 100       |
| Estable    | 60        |
| Decreciente| 20        |

(Se calcula con regresión lineal sobre búsquedas en el tiempo.)

### Revenue (peso 10%)

Umbral por defecto: **500 USD**.

| Revenue (vs 500 USD) | Sub-score |
|----------------------|-----------|
| ≥ 2,500 USD          | 100       |
| ≥ 1,000 USD          | 80        |
| ≥ 500 USD            | 60        |
| > 0                  | 30        |
| 0                    | 0         |

---

## 3. De score a prioridad

| Score final | Prioridad   | Significado |
|-------------|-------------|-------------|
| **≥ 85**    | **Alta**    | Candidato prioritario para stock propio. |
| **≥ 70**    | **Media**   | Candidato viable; se considera "recomendado". |
| **≥ 50**    | **Considerar** | Score moderado; conviene monitorear. |
| **< 50**    | **No recomendado** | No se recomienda stock propio por ahora. |

- **"Recomendado para stock propio"** = score ≥ 70 (es decir, Prioridad Alta o Media).
- En la tarjeta del dashboard, **"Referencias candidatas"** cuenta solo las que tienen score ≥ 70.

---

## 4. Ejemplos numéricos

**Ejemplo A – Prioridad Alta (score ~87)**  
- Conversión 55% → 100 × 0.40 = 40  
- 80 búsquedas → 80 × 0.30 = 24  
- Tendencia creciente → 100 × 0.20 = 20  
- Revenue 3,000 USD → 80 × 0.10 = 8  
- **Total ≈ 92** → Prioridad **Alta**.

**Ejemplo B – Prioridad Media (score ~72)**  
- Conversión 35% → 60 × 0.40 = 24  
- 40 búsquedas → 80 × 0.30 = 24  
- Tendencia estable → 60 × 0.20 = 12  
- Revenue 1,000 USD → 80 × 0.10 = 8  
- **Total ≈ 68** → por debajo de 70; subiendo un poco volumen o conversión se llega a **Media**.

**Ejemplo C – Considerar (score ~55)**  
- Conversión 25% → 30 × 0.40 = 12  
- 25 búsquedas → 60 × 0.30 = 18  
- Tendencia estable → 60 × 0.20 = 12  
- Revenue 200 USD → 30 × 0.10 = 3  
- **Total ≈ 45** → **Considerar** (entre 50 y 70 con otros números) o **No recomendado** (< 50).

---

## 5. Dónde está definido en código

- **Lógica completa:** `src/lib/analytics/stock-recommender.ts`
- **Umbrales por defecto:** constante `DEFAULT_CRITERIA` en ese archivo
- **Uso en informe de conversión:** las prioridades se calculan en el endpoint de analytics y se muestran en la tabla de referencias y en la tarjeta del dashboard.

Si quieres cambiar pesos, umbrales (conversión mínima, volumen mínimo, revenue mínimo en USD) o los rangos de score para Alta/Media/Considerar, se hace en `stock-recommender.ts` (y opcionalmente exponiendo criterios por API o config).
