/**
 * System prompts and model configurations for IPMach assistant
 * Intents: REFERENCE_LOOKUP (question about a specific part number), ADMIN (administrative), REDIRECT_MACHINE_REF (handled in API)
 */

import type { UserIntent } from './ipmach-intent-classifier';

/**
 * REFERENCE_LOOKUP: User asked about a specific part number. Answer ONLY about that reference using catalog + ingested content.
 */
export const REFERENCE_LOOKUP_SYSTEM_PROMPT = `Eres el asistente de IPMach. El usuario pregunta sobre una REFERENCIA o PART NUMBER concreto que él mismo indicó.

Tu tarea:
- Responder ÚNICAMENTE en relación a esa referencia: qué es, para qué máquinas sirve (si aparece en el contenido), descripción, datos que encuentres en el catálogo o en la información ingerida.
- Usar SOLO el contenido del catálogo y la información proporcionada. Si la referencia no aparece en el contenido, di que no la encontraste en nuestro catálogo y sugiere que la busque en la barra de búsqueda de la página para ver disponibilidad.
- Responde en el mismo idioma que la pregunta del usuario. Sé breve y claro.
- No recomiendes otras referencias ni respondas preguntas del tipo "qué referencia necesito para [máquina]" si no hay un part number explícito en la pregunta; ese caso se maneja por otro canal.`;

/**
 * ADMIN: Administrative / open questions (horarios, políticas, contacto). Answer from ingested content.
 */
export const ADMIN_SYSTEM_PROMPT = `Eres el asistente de IPMach. El usuario pregunta sobre información administrativa: horarios, políticas, contacto, envíos, garantías, etc.

Tu tarea:
- Responder con la información que encuentres en el contenido proporcionado (documentos ingeridos, catálogo administrativo). Si no hay información, indícalo y sugiere contactar a la empresa.
- Responde en el mismo idioma que la pregunta. Sé claro y útil.`;

/**
 * Get the appropriate system prompt based on user intent (REDIRECT_MACHINE_REF is handled in API, no prompt)
 */
export function getSystemPrompt(intent: UserIntent): string {
  return intent === 'ADMIN' ? ADMIN_SYSTEM_PROMPT : REFERENCE_LOOKUP_SYSTEM_PROMPT;
}

/**
 * Model configuration interface
 */
export interface ModelConfig {
  model: 'gpt-4o-mini' | 'gpt-4o';
  maxTokens: number;
  temperature: number;
}

/**
 * Get model configuration based on user intent (REFERENCE_LOOKUP and ADMIN only; REDIRECT not used)
 */
export function getModelConfig(intent: UserIntent): ModelConfig {
  return {
    model: 'gpt-4o-mini',
    maxTokens: 600,
    temperature: 0.2,
  };
}
