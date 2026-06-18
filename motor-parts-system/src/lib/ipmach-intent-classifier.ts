/**
 * Intent classifier for IPMach assistant – routes user to reference-centric or admin flow
 * REFERENCE_LOOKUP: user asks about a specific part number/reference → answer only about that reference (PDF/ingested).
 * ADMIN: administrative questions (horarios, políticas, contacto) → open answers from ingested content.
 * REDIRECT_MACHINE_REF: user asks "which reference/part for this machine?" → do not answer; redirect to search/supplier.
 */

import type OpenAI from 'openai';

export type UserIntent = 'REFERENCE_LOOKUP' | 'ADMIN' | 'REDIRECT_MACHINE_REF';

/**
 * Classify user intent: reference-specific vs admin vs "which part for machine" (redirect)
 */
export async function classifyUserIntent(
  question: string,
  openai: OpenAI
): Promise<UserIntent> {
  const classificationPrompt = `Clasifica la intención en UNA palabra:

REFERENCE_LOOKUP: El usuario menciona o pregunta por un part number o referencia CONCRETA (ej. "qué es 5S6684", "para qué sirve 9X1439", "máquinas compatibles con 1R0750"). Hay un código/referencia explícito en la pregunta.
ADMIN: Pregunta sobre horarios, políticas, contacto, envíos, precios de envío, información administrativa o de la empresa. No pide una referencia de repuesto.
REDIRECT_MACHINE_REF: El usuario pregunta qué referencia o part number necesita para una máquina o sistema SIN dar un part number (ej. "bomba de agua para Cat 416", "qué referencia lleva la 320", "qué filtro necesito para mi excavadora"). Pide que TÚ le digas cuál es la referencia.

Pregunta: "${question}"

Responde solo: REFERENCE_LOOKUP, ADMIN o REDIRECT_MACHINE_REF`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: classificationPrompt }],
      max_tokens: 25,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim().toUpperCase();
    const intent = raw?.replace(/\s/g, '')?.replace('REDIRECTMACHINEREF', 'REDIRECT_MACHINE_REF');
    if (intent === 'REFERENCE_LOOKUP' || intent === 'ADMIN' || intent === 'REDIRECT_MACHINE_REF') {
      return intent as UserIntent;
    }
  } catch (e) {
    console.warn('[intent-classifier] GPT classification failed, using fallback', e);
  }

  return classifyByKeywords(question);
}

/**
 * Fallback: detect REDIRECT when asking "what part for machine", ADMIN keywords, else REFERENCE_LOOKUP
 */
function classifyByKeywords(question: string): UserIntent {
  const lower = question.toLowerCase().trim();

  const adminKeywords = [
    'horario', 'horarios', 'atención', 'contacto', 'email', 'teléfono', 'envío', 'envíos',
    'política', 'políticas', 'devolución', 'garantía', 'miami', 'precio de envío', 'costo de envío',
  ];
  if (adminKeywords.some((kw) => lower.includes(kw))) {
    console.log('[intent-classifier] Classified as ADMIN by keywords');
    return 'ADMIN';
  }

  const machineRefPatterns = [
    /qué\s+(referencia|parte|pieza|repuesto|filtro|bomba)\s+(para|necesito|usa|lleva)/i,
    /cual\s+(es\s+)?(la\s+)?(referencia|bomba|filtro|pieza)\s+para/i,
    /(referencia|part number|part number)\s+para\s+(cat|komatsu|john deere|excavadora|bulldozer)/i,
    /(bomba|filtro|pieza)\s+de\s+agua\s+para/i,
    /para\s+(una\s+)?(cat|416|320|excavadora)/i,
  ];
  const hasMachineRefAsk = machineRefPatterns.some((r) => r.test(question));
  const hasExplicitPartNumber = /\b[A-Z0-9]{4,}[- ]?[0-9]+\b|\b\d+[A-Z]+\d*\b/i.test(question);
  if (hasMachineRefAsk && !hasExplicitPartNumber) {
    console.log('[intent-classifier] Classified as REDIRECT_MACHINE_REF by keywords');
    return 'REDIRECT_MACHINE_REF';
  }

  console.log('[intent-classifier] Classified as REFERENCE_LOOKUP (default)');
  return 'REFERENCE_LOOKUP';
}
